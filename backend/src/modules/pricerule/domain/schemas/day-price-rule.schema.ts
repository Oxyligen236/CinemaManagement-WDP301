import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { DayType } from '../enums/day-type.enum';

export type DayPriceRuleDocument = HydratedDocument<DayPriceRule>;

@Schema({
  collection: 'day_price_rules',
  timestamps: true,
})
export class DayPriceRule {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  ruleId!: string;

  @Prop({
    type: String,
    enum: DayType,
    default: DayType.WEEKDAY,
    required: true,
  })
  dayType!: DayType;

  @Prop({
    required: true,
    default: 0,
  })
  adjustmentValue!: number;
}

export const DayPriceRuleSchema = SchemaFactory.createForClass(DayPriceRule);

DayPriceRuleSchema.index({ dayType: 1 });
