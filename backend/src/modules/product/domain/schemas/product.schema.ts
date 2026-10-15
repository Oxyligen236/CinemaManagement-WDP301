import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { ProductStatus } from '../enums/product-status.enum';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  collection: 'products',
  timestamps: true,
})
export class Product {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  productId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  branchId!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  productName!: string;

  @Prop({
    required: true,
    min: 0,
  })
  price!: number;

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  stockQuantity!: number;

  @Prop({
    type: String,
    enum: ProductStatus,
    default: ProductStatus.AVAILABLE,
    required: true,
  })
  status!: ProductStatus;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ branchId: 1, status: 1 });
ProductSchema.index({ productName: 1 });
