import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type ProductOrderDocument = HydratedDocument<ProductOrder>;

@Schema({
  collection: 'product_orders',
  timestamps: true,
})
export class ProductOrder {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  productOrderId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  orderId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  productId!: string;

  @Prop({
    required: true,
    min: 1,
  })
  quantity!: number;

  @Prop({
    required: true,
    min: 0,
  })
  unitPrice!: number;
}

export const ProductOrderSchema = SchemaFactory.createForClass(ProductOrder);

ProductOrderSchema.index({ orderId: 1 });
ProductOrderSchema.index({ productId: 1 });
