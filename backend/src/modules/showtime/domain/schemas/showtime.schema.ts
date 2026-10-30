import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  DayPriceSelection,
  DayPriceSelectionSubSchema,
  SeatPriceSelection,
  SeatPriceSelectionSubSchema,
} from './price-selection.schema';

export type ShowtimeDocument = HydratedDocument<Showtime>;

@Schema({
  collection: 'showtimes',
  timestamps: true,
})
export class Showtime {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Movie',
    required: true,
  })
  movieId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Room',
    required: true,
  })
  roomId!: Types.ObjectId;

  @Prop({
    required: true,
  })
  startTime!: Date;

  @Prop({
    required: true,
  })
  endTime!: Date;

  @Prop({
    required: true,
    min: 0,
  })
  basePrice!: number;

  /** @deprecated Giữ để đọc dữ liệu cũ; thay bằng dayPriceSelections (không còn được ghi). */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
  })
  dayPriceRuleId?: Types.ObjectId;

  /** @deprecated Giữ để đọc dữ liệu cũ; thay bằng seatPriceSelections (không còn được ghi). */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
  })
  seatPriceRuleId?: Types.ObjectId;

  // Snapshot hệ số giá theo loại ghế (UC-05). Suất cũ không có -> [] (coi như 1.0)
  @Prop({ type: [SeatPriceSelectionSubSchema], default: [] })
  seatPriceSelections!: SeatPriceSelection[];

  // Snapshot hệ số giá theo loại ngày (UC-05). Suất cũ không có -> [] (coi như 1.0)
  @Prop({ type: [DayPriceSelectionSubSchema], default: [] })
  dayPriceSelections!: DayPriceSelection[];
}

export const ShowtimeSchema = SchemaFactory.createForClass(Showtime);

ShowtimeSchema.index({ startTime: 1 });
ShowtimeSchema.index({ movieId: 1, startTime: 1 });
ShowtimeSchema.index({ roomId: 1, startTime: 1, endTime: 1 });
