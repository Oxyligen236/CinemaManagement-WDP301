import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { VNPay, ignoreLogger } from 'vnpay';
import { Payment, PaymentDocument } from '../domain/schemas/payment.schema';
import { PaymentMethod } from '../domain/enums/payment-method.enum';
import { PaymentStatus } from '../domain/enums/payment-status.enum';
import {
  CashPaymentSummaryDto,
  PaymentContract,
  PaymentStatusSummaryDto,
  QrPaymentSummaryDto,
  VnpayPaymentUrlDto,
} from './payment.contract';

@Injectable()
export class PaymentContractImpl implements PaymentContract {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async createVnpayPayment(params: {
    orderId: string;
    amount: number;
    ipAddr: string;
    returnUrl: string;
  }): Promise<VnpayPaymentUrlDto> {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secureSecret = process.env.VNPAY_HASH_SECRET;
    if (!tmnCode || !secureSecret) {
      throw new BadRequestException('VNPay sandbox chưa được cấu hình');
    }
    if (!Number.isSafeInteger(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán không hợp lệ');
    }

    const orderObjectId = Types.ObjectId.isValid(params.orderId)
      ? new Types.ObjectId(params.orderId)
      : params.orderId;

    let payment = await this.paymentModel
      .findOne({
        orderId: orderObjectId,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      })
      .exec();
    if (!payment) {
      payment = await this.paymentModel.create({
        orderId: orderObjectId,
        amount: params.amount,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      });
    } else if (payment.amount !== params.amount) {
      throw new BadRequestException('Số tiền đơn hàng đã thay đổi');
    }

    const paymentId = payment._id.toString();
    const vnpay = new VNPay({
      tmnCode,
      secureSecret,
      vnpayHost: process.env.VNPAY_HOST || 'https://sandbox.vnpayment.vn',
      testMode: true,
      enableLog: false,
      loggerFn: ignoreLogger,
    });
    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: params.amount,
      vnp_IpAddr: params.ipAddr,
      vnp_ReturnUrl: params.returnUrl,
      vnp_TxnRef: paymentId,
      vnp_OrderInfo: `Thanh toan don ${params.orderId}`,
    });
    return {
      paymentId,
      orderId: params.orderId,
      paymentUrl,
      status: payment.status,
    };
  }

  async verifyVnpayReturn(query: Record<string, string | string[]>) {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secureSecret = process.env.VNPAY_HASH_SECRET;
    if (!tmnCode || !secureSecret)
      throw new BadRequestException('VNPay chưa được cấu hình');
    const result = new VNPay({
      tmnCode,
      secureSecret,
      testMode: true,
      enableLog: false,
      loggerFn: ignoreLogger,
    }).verifyReturnUrl(query as Parameters<VNPay['verifyReturnUrl']>[0]);
    const txnRef = typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef : '';

    const queryFilter = Types.ObjectId.isValid(txnRef)
      ? { _id: new Types.ObjectId(txnRef), method: PaymentMethod.VNPAY }
      : { method: PaymentMethod.VNPAY };
    const payment = await this.paymentModel.findOne(queryFilter).exec();
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch VNPay');
    if (!result.isVerified || Number(result.vnp_Amount) !== payment.amount)
      throw new BadRequestException('Thông tin giao dịch VNPay không hợp lệ');
    return {
      isSuccess: result.isVerified && result.isSuccess,
      orderId: payment.orderId.toString(),
      message: result.message,
      responseCode: String(query.vnp_ResponseCode || ''),
    };
  }

  async verifyVnpayIpn(query: Record<string, string | string[]>) {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secureSecret = process.env.VNPAY_HASH_SECRET;
    if (!tmnCode || !secureSecret)
      throw new BadRequestException('VNPay chưa được cấu hình');
    const result = new VNPay({
      tmnCode,
      secureSecret,
      testMode: true,
      enableLog: false,
      loggerFn: ignoreLogger,
    }).verifyIpnCall(query as Parameters<VNPay['verifyIpnCall']>[0]);
    if (!result.isVerified)
      return { RspCode: '97', Message: 'Invalid checksum' };

    const txnRef = String(result.vnp_TxnRef || '');
    const queryFilter = Types.ObjectId.isValid(txnRef)
      ? { _id: new Types.ObjectId(txnRef), method: PaymentMethod.VNPAY }
      : { method: PaymentMethod.VNPAY };
    const payment = await this.paymentModel.findOne(queryFilter).exec();
    if (!payment) return { RspCode: '01', Message: 'Order not found' };
    // vnpay SDK normalizes vnp_Amount back to VND after verification.
    if (Number(result.vnp_Amount) !== payment.amount)
      return { RspCode: '04', Message: 'Invalid amount' };
    if (payment.status !== PaymentStatus.PENDING) {
      return payment.status === PaymentStatus.SUCCESS
        ? {
            RspCode: '00',
            Message: 'Confirm Success',
            orderId: payment.orderId.toString(),
            isSuccess: true,
          }
        : {
            RspCode: '02',
            Message: 'Order already confirmed',
            orderId: payment.orderId.toString(),
            isSuccess: false,
          };
    }
    payment.status = result.isSuccess
      ? PaymentStatus.SUCCESS
      : PaymentStatus.FAILED;
    payment.transactionId = String(result.vnp_TransactionNo || '');
    await payment.save();
    return {
      RspCode: '00',
      Message: 'Confirm Success',
      orderId: payment.orderId.toString(),
      isSuccess: result.isSuccess,
    };
  }

  async getVnpayPaymentStatus(orderId: string) {
    const orderFilter = Types.ObjectId.isValid(orderId)
      ? { orderId: new Types.ObjectId(orderId), method: PaymentMethod.VNPAY }
      : { orderId, method: PaymentMethod.VNPAY };
    const payment = await this.paymentModel
      .findOne(orderFilter as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return { isSuccess: payment?.status === PaymentStatus.SUCCESS };
  }

  async processCashPayment(params: {
    orderId: string;
    totalAmount: number;
    cashReceived: number;
  }): Promise<CashPaymentSummaryDto> {
    if (params.cashReceived < params.totalAmount) {
      throw new BadRequestException(
        `Số tiền khách đưa (${params.cashReceived.toLocaleString('vi-VN')} đ) không đủ để thanh toán tổng tiền (${params.totalAmount.toLocaleString('vi-VN')} đ)`,
      );
    }

    const changeAmount = params.cashReceived - params.totalAmount;
    const now = new Date();

    const orderObjectId = Types.ObjectId.isValid(params.orderId)
      ? new Types.ObjectId(params.orderId)
      : params.orderId;

    const payment = new this.paymentModel({
      orderId: orderObjectId,
      amount: params.totalAmount,
      method: PaymentMethod.CASH,
      status: PaymentStatus.SUCCESS,
      transactionId: `CASH-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const saved = await payment.save();

    return {
      paymentId: saved._id.toString(),
      orderId: saved.orderId.toString(),
      amount: saved.amount,
      cashReceived: params.cashReceived,
      changeAmount,
      method: saved.method,
      status: saved.status,
      paidAt: now,
    };
  }

  async generateQrPayment(params: {
    orderId: string;
    amount: number;
    method?: PaymentMethod;
    description?: string;
  }): Promise<QrPaymentSummaryDto> {
    if (params.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

    const method = params.method ?? PaymentMethod.VNPAY;
    const description =
      params.description || `MYCAST ${params.orderId.slice(0, 8)}`;

    const orderObjectId = Types.ObjectId.isValid(params.orderId)
      ? new Types.ObjectId(params.orderId)
      : params.orderId;

    let payment = await this.paymentModel
      .findOne({
        orderId: orderObjectId,
        status: PaymentStatus.PENDING,
      })
      .exec();

    if (!payment) {
      payment = new this.paymentModel({
        orderId: orderObjectId,
        amount: params.amount,
        method,
        status: PaymentStatus.PENDING,
        transactionId: `QR-${Date.now()}-${randomUUID().slice(0, 8)}`,
      });
      await payment.save();
    }

    const bankId = process.env.VIETQR_BANK_ID || 'MB';
    const accountNo = process.env.VIETQR_ACCOUNT_NO || '0333888999';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || 'MYCAST CINEMA';
    const encodedDesc = encodeURIComponent(description);
    const encodedAccountName = encodeURIComponent(accountName);

    const qrCodeUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${params.amount}&addInfo=${encodedDesc}&accountName=${encodedAccountName}`;
    const qrPayload = `00020101021238540010A00000072701240006${bankId}0110${accountNo}0208QRIBFTTA5303704540${params.amount}5802VN62${description.length}${description}6304`;

    return {
      paymentId: payment._id.toString(),
      orderId: payment.orderId.toString(),
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      qrCodeUrl,
      qrPayload,
    };
  }

  async checkPaymentStatus(
    identifier: string,
  ): Promise<PaymentStatusSummaryDto> {
    const isObjectId = Types.ObjectId.isValid(identifier);
    const query = isObjectId
      ? {
          $or: [
            { _id: new Types.ObjectId(identifier) },
            { orderId: new Types.ObjectId(identifier) },
          ],
        }
      : { orderId: identifier };

    const payment = await this.paymentModel
      .findOne(query as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy giao dịch thanh toán cho mã: ${identifier}`,
      );
    }

    return {
      paymentId: payment._id.toString(),
      orderId: payment.orderId.toString(),
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      transactionId: payment.transactionId,
    };
  }
}
