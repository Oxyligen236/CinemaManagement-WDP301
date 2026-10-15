import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type SeatOrderDocument = HydratedDocument<SeatOrder>;

@Schema({
  collection: 'seat_orders',
  timestamps: true,
})
export class SeatOrder {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  seatOrderId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  orderId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  seatShowtimeId!: string;

  @Prop({
    required: true,
    min: 0,
  })
  price!: number;

  @Prop({
    required: true,
    default: Date.now,
  })
  orderAt!: Date;
}

export const SeatOrderSchema = SchemaFactory.createForClass(SeatOrder);

SeatOrderSchema.index({ orderId: 1 });
SeatOrderSchema.index({ seatShowtimeId: 1 });
