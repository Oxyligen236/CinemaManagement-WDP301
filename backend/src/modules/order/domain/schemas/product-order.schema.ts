import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProductOrderDocument = HydratedDocument<ProductOrder>;

@Schema({
  collection: 'product_orders',
  timestamps: true,
})
export class ProductOrder {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
    required: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Product',
    required: true,
  })
  productId!: Types.ObjectId;

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
