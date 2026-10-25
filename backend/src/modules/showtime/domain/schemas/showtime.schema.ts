import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
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
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  showtimeId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  movieId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  roomId!: string;

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
    trim: true,
  })
  dayPriceRuleId?: string;

  /** @deprecated Giữ để đọc dữ liệu cũ; thay bằng seatPriceSelections (không còn được ghi). */
  @Prop({
    trim: true,
  })
  seatPriceRuleId?: string;

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
