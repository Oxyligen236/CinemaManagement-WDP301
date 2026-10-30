import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

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
    type: MongooseSchema.Types.ObjectId,
    ref: 'Promotion',
    required: true,
    index: true,
  })
  promotionId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    required: true,
    default: () => new Date(),
  })
  usedAt!: Date;
}

export const PromotionUsageSchema =
  SchemaFactory.createForClass(PromotionUsage);

PromotionUsageSchema.index({ promotionId: 1, userId: 1 }, { unique: true });
