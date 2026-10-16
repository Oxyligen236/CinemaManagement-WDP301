import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { DiscountType } from '../enums/discount-type.enum';

export type PromotionDocument = HydratedDocument<Promotion>;

@Schema({
  collection: 'promotions',
  timestamps: true,
})
export class Promotion {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  promotionId!: string;

  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  promotionCode!: string;

  @Prop({
    required: true,
    min: 0,
  })
  discountValue!: number;

  @Prop({
    type: String,
    enum: DiscountType,
    default: DiscountType.PERCENTAGE,
    required: true,
  })
  discountType!: DiscountType;

  @Prop({
    required: true,
  })
  startDate!: Date;

  @Prop({
    required: true,
  })
  endDate!: Date;

  @Prop({
    required: true,
    default: true,
  })
  isActive!: boolean;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);

PromotionSchema.index({ promotionCode: 1 }, { unique: true });
PromotionSchema.index({ startDate: 1, endDate: 1, isActive: 1 });
