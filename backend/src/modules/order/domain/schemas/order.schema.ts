import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { OrderStatus } from '../enums/order-status.enum';

export type OrderDocument = HydratedDocument<Order>;

@Schema({
  collection: 'orders',
  timestamps: true,
})
export class Order {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  orderId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  userId!: string;

  @Prop({
    trim: true,
  })
  staffId?: string;

  @Prop({
    trim: true,
  })
  branchId?: string;

  @Prop({
    trim: true,
    default: 'ONLINE',
  })
  channel?: string;

  @Prop({
    trim: true,
  })
  customerPhone?: string;

  @Prop({
    trim: true,
  })
  customerName?: string;

  @Prop({
    trim: true,
  })
  paymentMethod?: string;

  @Prop({
    trim: true,
  })
  promotionId?: string;

  @Prop({
    trim: true,
    uppercase: true,
  })
  promotionCode?: string;

  @Prop({
    required: false,
    default: 0,
    min: 0,
  })
  discountAmount?: number;

  @Prop({
    required: false,
    min: 0,
  })
  finalAmount?: number;

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  totalAmount!: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    required: true,
  })
  status!: OrderStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ branchId: 1, createdAt: -1 });
OrderSchema.index({ staffId: 1, createdAt: -1 });
