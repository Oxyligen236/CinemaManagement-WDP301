import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { SeatShowtimeStatus } from '../enums/seat-showtime-status.enum';

export type SeatShowtimeDocument = HydratedDocument<SeatShowtime>;

@Schema({
  collection: 'seat_showtimes',
  timestamps: true,
})
export class SeatShowtime {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Showtime',
    required: true,
  })
  showtimeId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Seat',
    required: true,
  })
  seatId!: Types.ObjectId;

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
