import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { SeatType } from '../enums/seat-type.enum';
import { SeatStatus } from '../enums/seat-status.enum';

export type SeatDocument = HydratedDocument<Seat>;

@Schema({
  collection: 'seats',
  timestamps: true,
})
export class Seat {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  seatId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  roomId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  rowPosition!: string;

  @Prop({
    required: true,
  })
  columnPosition!: number;

  @Prop({
    type: String,
    enum: SeatType,
    default: SeatType.STANDARD,
    required: true,
  })
  seatType!: SeatType;

  @Prop({
    type: String,
    enum: SeatStatus,
    default: SeatStatus.AVAILABLE,
    required: true,
  })
  status!: SeatStatus;
}

export const SeatSchema = SchemaFactory.createForClass(Seat);

SeatSchema.index(
  { roomId: 1, rowPosition: 1, columnPosition: 1 },
  { unique: true },
);
SeatSchema.index({ roomId: 1, status: 1 });
