import { IsEnum, IsNumber, Min } from 'class-validator';
import { PaymentMethod } from '../../domain/enums/payment-method.enum';

export class ProcessPosCashPaymentReq {
  @IsNumber()
  @Min(0)
  cashReceived!: number;
}

export class InitiatePosQrPaymentReq {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
