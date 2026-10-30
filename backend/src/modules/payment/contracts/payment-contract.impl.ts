import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { VNPay, ignoreLogger } from 'vnpay';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  CashPaymentSummaryDto,
  PaymentContract,
  PaymentStatusSummaryDto,
  QrPaymentSummaryDto,
  VnpayPaymentUrlDto,
} from './payment.contract';

@Injectable()
export class PaymentContractImpl implements PaymentContract {
  constructor(private readonly prisma: PrismaService) {}

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

    let payment = await this.prisma.payment.findFirst({
      where: {
        orderId: params.orderId,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      },
    });

    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId: params.orderId,
          amount: params.amount,
          method: PaymentMethod.VNPAY,
          status: PaymentStatus.PENDING,
        },
      });
    } else if (payment.amount !== params.amount) {
      throw new BadRequestException('Số tiền đơn hàng đã thay đổi');
    }

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
      vnp_TxnRef: payment.id,
      vnp_OrderInfo: `Thanh toan don ${params.orderId}`,
    });
    return {
      paymentId: payment.id,
      orderId: params.orderId,
      paymentUrl,
      status: payment.status as any,
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
    const paymentId =
      typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef : '';
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, method: PaymentMethod.VNPAY },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch VNPay');
    if (!result.isVerified || Number(result.vnp_Amount) !== payment.amount)
      throw new BadRequestException('Thông tin giao dịch VNPay không hợp lệ');
    return {
      isSuccess: result.isVerified && result.isSuccess,
      orderId: payment.orderId,
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
    const payment = await this.prisma.payment.findFirst({
      where: { id: result.vnp_TxnRef, method: PaymentMethod.VNPAY },
    });
    if (!payment) return { RspCode: '01', Message: 'Order not found' };
    if (Number(result.vnp_Amount) !== payment.amount)
      return { RspCode: '04', Message: 'Invalid amount' };
    if (payment.status !== PaymentStatus.PENDING) {
      return payment.status === PaymentStatus.SUCCESS
        ? {
            RspCode: '00',
            Message: 'Confirm Success',
            orderId: payment.orderId,
            isSuccess: true,
          }
        : {
            RspCode: '02',
            Message: 'Order already confirmed',
            orderId: payment.orderId,
            isSuccess: false,
          };
    }

    const nextStatus = result.isSuccess
      ? PaymentStatus.SUCCESS
      : PaymentStatus.FAILED;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        transactionId: String(result.vnp_TransactionNo || ''),
      },
    });

    return {
      RspCode: '00',
      Message: 'Confirm Success',
      orderId: payment.orderId,
      isSuccess: result.isSuccess,
    };
  }

  async getVnpayPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, method: PaymentMethod.VNPAY },
      orderBy: { createdAt: 'desc' },
    });
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

    const created = await this.prisma.payment.create({
      data: {
        orderId: params.orderId,
        amount: params.totalAmount,
        method: PaymentMethod.CASH,
        status: PaymentStatus.SUCCESS,
        transactionId: `CASH-${Date.now()}-${randomUUID().slice(0, 8)}`,
      },
    });

    return {
      paymentId: created.id,
      orderId: created.orderId,
      amount: created.amount,
      cashReceived: params.cashReceived,
      changeAmount,
      method: created.method as any,
      status: created.status as any,
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

    let payment = await this.prisma.payment.findFirst({
      where: {
        orderId: params.orderId,
        status: PaymentStatus.PENDING,
      },
    });

    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId: params.orderId,
          amount: params.amount,
          method,
          status: PaymentStatus.PENDING,
          transactionId: `QR-${Date.now()}-${randomUUID().slice(0, 8)}`,
        },
      });
    }

    const bankId = process.env.VIETQR_BANK_ID || 'MB';
    const accountNo = process.env.VIETQR_ACCOUNT_NO || '0333888999';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || 'MYCAST CINEMA';
    const encodedDesc = encodeURIComponent(description);
    const encodedAccountName = encodeURIComponent(accountName);

    const qrCodeUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${params.amount}&addInfo=${encodedDesc}&accountName=${encodedAccountName}`;
    const qrPayload = `00020101021238540010A00000072701240006${bankId}0110${accountNo}0208QRIBFTTA5303704540${params.amount}5802VN62${description.length}${description}6304`;

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method as any,
      status: payment.status as any,
      qrCodeUrl,
      qrPayload,
    };
  }

  async checkPaymentStatus(
    identifier: string,
  ): Promise<PaymentStatusSummaryDto> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [{ id: identifier }, { orderId: identifier }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy giao dịch thanh toán cho mã: ${identifier}`,
      );
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method as any,
      status: payment.status as any,
      transactionId: payment.transactionId ?? undefined,
    };
  }
}
