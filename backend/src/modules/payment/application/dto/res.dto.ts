import { PaymentMethod } from '../../domain/enums/payment-method.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { OrderPaymentTicketDto } from '../../../order/application/dto/res.dto';

export class CashPaymentSummaryDto {
  paymentId!: string;
  orderId!: string;
  amount!: number;
  cashReceived!: number;
  changeAmount!: number;
  method!: PaymentMethod;
  status!: PaymentStatus;
  paidAt!: Date;

  static of(
    paymentId: string,
    orderId: string,
    amount: number,
    cashReceived: number,
    changeAmount: number,
    method: PaymentMethod,
    status: PaymentStatus,
    paidAt: Date,
  ): CashPaymentSummaryDto {
    const res = new CashPaymentSummaryDto();
    Object.assign(res, {
      paymentId,
      orderId,
      amount,
      cashReceived,
      changeAmount,
      method,
      status,
      paidAt,
    });
    return res;
  }
}

export class QrPaymentSummaryDto {
  paymentId!: string;
  orderId!: string;
  amount!: number;
  method!: PaymentMethod;
  status!: PaymentStatus;
  qrCodeUrl!: string;
  qrPayload!: string;

  static of(
    paymentId: string,
    orderId: string,
    amount: number,
    method: PaymentMethod,
    status: PaymentStatus,
    qrCodeUrl: string,
    qrPayload: string,
  ): QrPaymentSummaryDto {
    const res = new QrPaymentSummaryDto();
    Object.assign(res, {
      paymentId,
      orderId,
      amount,
      method,
      status,
      qrCodeUrl,
      qrPayload,
    });
    return res;
  }
}

export class PaymentStatusSummaryDto {
  paymentId!: string;
  orderId!: string;
  amount!: number;
  method!: PaymentMethod;
  status!: PaymentStatus;
  transactionId?: string;

  static of(
    paymentId: string,
    orderId: string,
    amount: number,
    method: PaymentMethod,
    status: PaymentStatus,
    transactionId?: string,
  ): PaymentStatusSummaryDto {
    const res = new PaymentStatusSummaryDto();
    Object.assign(res, {
      paymentId,
      orderId,
      amount,
      method,
      status,
      transactionId,
    });
    return res;
  }
}

export class VnpayPaymentUrlDto {
  paymentId!: string;
  orderId!: string;
  paymentUrl!: string;
  status!: PaymentStatus;

  static of(
    paymentId: string,
    orderId: string,
    paymentUrl: string,
    status: PaymentStatus,
  ): VnpayPaymentUrlDto {
    const res = new VnpayPaymentUrlDto();
    Object.assign(res, {
      paymentId,
      orderId,
      paymentUrl,
      status,
    });
    return res;
  }
}

export class PosCashPaymentResultRes {
  orderId!: string;
  paymentId!: string;
  status!: string;
  totalAmount!: number;
  cashReceived!: number;
  changeAmount!: number;
  paidAt!: Date;
  tickets!: OrderPaymentTicketDto[];

  static of(
    orderId: string,
    paymentId: string,
    status: string,
    totalAmount: number,
    cashReceived: number,
    changeAmount: number,
    paidAt: Date,
    tickets: OrderPaymentTicketDto[],
  ): PosCashPaymentResultRes {
    const res = new PosCashPaymentResultRes();
    Object.assign(res, {
      orderId,
      paymentId,
      status,
      totalAmount,
      cashReceived,
      changeAmount,
      paidAt,
      tickets,
    });
    return res;
  }
}

export class PosQrPaymentRes {
  orderId!: string;
  paymentId!: string;
  amount!: number;
  paymentMethod!: PaymentMethod;
  paymentStatus!: PaymentStatus;
  qrCodeUrl!: string;
  qrPayload!: string;

  static of(
    orderId: string,
    paymentId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    paymentStatus: PaymentStatus,
    qrCodeUrl: string,
    qrPayload: string,
  ): PosQrPaymentRes {
    const res = new PosQrPaymentRes();
    Object.assign(res, {
      orderId,
      paymentId,
      amount,
      paymentMethod,
      paymentStatus,
      qrCodeUrl,
      qrPayload,
    });
    return res;
  }
}
