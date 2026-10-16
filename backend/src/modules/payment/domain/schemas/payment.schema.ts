import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({
  collection: 'payments',
  timestamps: true,
})
export class Payment {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  paymentId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  orderId!: string;

  @Prop({
    required: true,
    min: 0,
  })
  amount!: number;

  @Prop({
    type: String,
    enum: PaymentMethod,
    default: PaymentMethod.VNPAY,
    required: true,
  })
  method!: PaymentMethod;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    required: true,
  })
  status!: PaymentStatus;

  @Prop({
    trim: true,
  })
  transactionId?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ status: 1 });
