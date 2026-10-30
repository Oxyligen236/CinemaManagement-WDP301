import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ComboStatus } from '../enums/combo-status.enum';

export type ComboDocument = HydratedDocument<Combo>;

@Schema({ _id: false })
export class ComboItemRef {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Item',
    required: true,
  })
  itemId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;
}

export const ComboItemRefSchema = SchemaFactory.createForClass(ComboItemRef);

@Schema({
  collection: 'combos',
  timestamps: true,
})
export class Combo {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  name!: string;

  @Prop({
    required: true,
    min: 0,
  })
  price!: number;

  @Prop({
    type: String,
    enum: ComboStatus,
    default: ComboStatus.AVAILABLE,
    required: true,
    index: true,
  })
  status!: ComboStatus;

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

  @Prop({
    type: [ComboItemRefSchema],
    required: true,
    default: [],
  })
  items!: ComboItemRef[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const ComboSchema = SchemaFactory.createForClass(Combo);

ComboSchema.index({ branchId: 1, status: 1 });
ComboSchema.index({ branchId: 1, name: 1 });
