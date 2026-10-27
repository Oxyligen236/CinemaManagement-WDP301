import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { ItemStatus } from '../enums/item-status.enum';
import { ItemCategory } from '../enums/item-category.enum';
import { ItemSize } from '../enums/item-size.enum';

export type ItemDocument = HydratedDocument<Item>;

@Schema({
  collection: 'items',
  timestamps: true,
})
export class Item {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  itemId!: string;

  @Prop({
    required: true,
    trim: true,
    index: true,
  })
  branchId!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  name!: string;

  @Prop({
    type: String,
    enum: ItemCategory,
    required: true,
    index: true,
  })
  category!: ItemCategory;

  @Prop({
    type: String,
    enum: ItemSize,
    required: false,
    default: null,
  })
  size?: ItemSize | null;

  @Prop({
    required: true,
    min: 0,
  })
  price!: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
    min: 0,
  })
  costPrice!: number;

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  stockQuantity!: number;

  @Prop({
    required: true,
    default: 10,
    min: 0,
  })
  lowStockThreshold!: number;

  @Prop({
    type: String,
    enum: ItemStatus,
    default: ItemStatus.AVAILABLE,
    required: true,
    index: true,
  })
  status!: ItemStatus;

  @Prop({
    type: String,
    required: false,
    trim: true,
    default: null,
  })
  imageKey?: string | null;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 1000,
    default: null,
  })
  description?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ItemSchema = SchemaFactory.createForClass(Item);

ItemSchema.index({ branchId: 1, status: 1 });
ItemSchema.index({ branchId: 1, category: 1 });
ItemSchema.index({ branchId: 1, name: 1 });
