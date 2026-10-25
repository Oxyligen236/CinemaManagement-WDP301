import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  Payment,
  PaymentDocument,
} from '../../payment/domain/schemas/payment.schema';
import { PaymentMethod } from '../../payment/domain/enums/payment-method.enum';
import { PaymentStatus } from '../../payment/domain/enums/payment-status.enum';
import {
  CashPaymentSummaryDto,
  PaymentContract,
  PaymentStatusSummaryDto,
  QrPaymentSummaryDto,
} from './payment.contract';

@Injectable()
export class PaymentContractImpl implements PaymentContract {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

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

    const payment = new this.paymentModel({
      paymentId: randomUUID(),
      orderId: params.orderId,
      amount: params.totalAmount,
      method: PaymentMethod.CASH,
      status: PaymentStatus.SUCCESS,
      transactionId: `CASH-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const saved = await payment.save();

    return {
      paymentId: saved.paymentId,
      orderId: saved.orderId,
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

    let payment = await this.paymentModel
      .findOne({
        orderId: params.orderId,
        status: PaymentStatus.PENDING,
      })
      .exec();

    if (!payment) {
      payment = new this.paymentModel({
        paymentId: randomUUID(),
        orderId: params.orderId,
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
      paymentId: payment.paymentId,
      orderId: payment.orderId,
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
    const payment = await this.paymentModel
      .findOne({
        $or: [{ paymentId: identifier }, { orderId: identifier }],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy giao dịch thanh toán cho mã: ${identifier}`,
      );
    }

    return {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      transactionId: payment.transactionId,
    };
  }
}
