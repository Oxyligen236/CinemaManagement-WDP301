import { PaymentMethod } from '../domain/enums/payment-method.enum';
import { PaymentStatus } from '../domain/enums/payment-status.enum';

export { PaymentMethod, PaymentStatus };

export interface CashPaymentSummaryDto {
  paymentId: string;
  orderId: string;
  amount: number;
  cashReceived: number;
  changeAmount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: Date;
}

export interface QrPaymentSummaryDto {
  paymentId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  qrCodeUrl: string;
  qrPayload: string;
}

export interface PaymentStatusSummaryDto {
  paymentId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
}

export interface VnpayPaymentUrlDto {
  paymentId: string;
  orderId: string;
  paymentUrl: string;
  status: PaymentStatus;
}

export const PAYMENT_CONTRACT = Symbol('PAYMENT_CONTRACT');

export interface PaymentContract {
  processCashPayment(params: {
    orderId: string;
    totalAmount: number;
    cashReceived: number;
  }): Promise<CashPaymentSummaryDto>;

  generateQrPayment(params: {
    orderId: string;
    amount: number;
    method?: PaymentMethod;
    description?: string;
  }): Promise<QrPaymentSummaryDto>;

  checkPaymentStatus(identifier: string): Promise<PaymentStatusSummaryDto>;

  createVnpayPayment(params: {
    orderId: string;
    amount: number;
    ipAddr: string;
    returnUrl: string;
  }): Promise<VnpayPaymentUrlDto>;

  verifyVnpayReturn(query: Record<string, string | string[]>): Promise<{
    isSuccess: boolean;
    orderId: string;
    message: string;
    responseCode?: string;
  }>;
  verifyVnpayIpn(query: Record<string, string | string[]>): Promise<{
    RspCode: string;
    Message: string;
    orderId?: string;
    isSuccess?: boolean;
  }>;
  getVnpayPaymentStatus(orderId: string): Promise<{ isSuccess: boolean }>;
}
