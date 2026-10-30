import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ProductStatus } from '../enums/product-status.enum';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  collection: 'products',
  timestamps: true,
})
export class Product {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    trim: true,
  })
  branchId!: Types.ObjectId;

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
