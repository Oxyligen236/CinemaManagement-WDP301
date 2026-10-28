import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type PromotionUsageDocument = HydratedDocument<PromotionUsage> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({
  collection: 'promotion_usages',
  timestamps: true,
})
export class PromotionUsage {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  usageId!: string;

  @Prop({
    required: true,
    index: true,
  })
  promotionId!: string;

  @Prop({
    required: true,
    index: true,
  })
  userId!: string;

  @Prop({
    required: true,
    index: true,
  })
  orderId!: string;

  @Prop({
    required: true,
    default: () => new Date(),
  })
  usedAt!: Date;
}

export const PromotionUsageSchema =
  SchemaFactory.createForClass(PromotionUsage);

PromotionUsageSchema.index({ promotionId: 1, userId: 1 }, { unique: true });
