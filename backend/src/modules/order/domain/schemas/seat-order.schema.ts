import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SeatOrderDocument = HydratedDocument<SeatOrder>;

@Schema({
  collection: 'seat_orders',
  timestamps: true,
})
export class SeatOrder {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
    required: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SeatShowtime',
    required: true,
  })
  seatShowtimeId!: Types.ObjectId;

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
