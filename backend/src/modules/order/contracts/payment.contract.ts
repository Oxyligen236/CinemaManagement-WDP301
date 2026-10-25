import { PaymentMethod } from '../../payment/domain/enums/payment-method.enum';
import { PaymentStatus } from '../../payment/domain/enums/payment-status.enum';

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
}
