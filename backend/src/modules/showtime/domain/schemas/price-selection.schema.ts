import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Snapshot hệ số giá theo loại ghế tại thời điểm lưu suất chiếu.
 * Dùng string cho seatType để không phụ thuộc enum của module pricerule.
 */
@Schema({ _id: false })
export class SeatPriceSelection {
  @Prop({ type: String, required: true })
  seatType!: string;

  @Prop({ type: String, default: null })
  ruleId!: string | null;

  @Prop({ type: Number, required: true, default: 1 })
  multiplier!: number;
}

/**
 * Snapshot hệ số giá theo loại ngày tại thời điểm lưu suất chiếu.
 */
@Schema({ _id: false })
export class DayPriceSelection {
  @Prop({ type: String, required: true })
  dayType!: string;

  @Prop({ type: String, default: null })
  ruleId!: string | null;

  @Prop({ type: Number, required: true, default: 1 })
  multiplier!: number;
}

export const SeatPriceSelectionSubSchema =
  SchemaFactory.createForClass(SeatPriceSelection);
export const DayPriceSelectionSubSchema =
  SchemaFactory.createForClass(DayPriceSelection);
