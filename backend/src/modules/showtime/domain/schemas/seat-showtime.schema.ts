import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { SeatShowtimeStatus } from '../enums/seat-showtime-status.enum';

export type SeatShowtimeDocument = HydratedDocument<SeatShowtime>;

@Schema({
  collection: 'seat_showtimes',
  timestamps: true,
})
export class SeatShowtime {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  seatShowtimeId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  showtimeId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  seatId!: string;

  @Prop({
    type: String,
    enum: SeatShowtimeStatus,
    default: SeatShowtimeStatus.EMPTY,
    required: true,
  })
  seatStatus!: SeatShowtimeStatus;
}

export const SeatShowtimeSchema = SchemaFactory.createForClass(SeatShowtime);

SeatShowtimeSchema.index({ showtimeId: 1, seatId: 1 }, { unique: true });
SeatShowtimeSchema.index({ showtimeId: 1, seatStatus: 1 });
