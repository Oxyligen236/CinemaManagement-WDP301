import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { SeatType } from '../enums/seat-type.enum';

export type SeatPriceRuleDocument = HydratedDocument<SeatPriceRule>;

@Schema({
  collection: 'seat_price_rules',
  timestamps: true,
})
export class SeatPriceRule {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  ruleId!: string;

  @Prop({
    type: String,
    enum: SeatType,
    default: SeatType.STANDARD,
    required: true,
  })
  seatType!: SeatType;

  @Prop({
    required: true,
    default: 0,
  })
  adjustmentValue!: number;
}

export const SeatPriceRuleSchema = SchemaFactory.createForClass(SeatPriceRule);

SeatPriceRuleSchema.index({ seatType: 1 });
