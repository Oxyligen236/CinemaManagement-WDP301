import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { ComboStatus } from '../enums/combo-status.enum';

export type ComboDocument = HydratedDocument<Combo>;

@Schema({ _id: false })
export class ComboItemRef {
  @Prop({ type: String, required: true, trim: true })
  itemId!: string;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;
}

export const ComboItemRefSchema = SchemaFactory.createForClass(ComboItemRef);

@Schema({
  collection: 'combos',
  timestamps: true,
})
export class Combo {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  comboId!: string;

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
