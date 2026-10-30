import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BranchStatus } from '../enums/branch-status.enum';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({
  collection: 'branches',
  timestamps: true,
})
export class Branch {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  branchName!: string;

  @Prop({
    required: true,
    trim: true,
  })
  address!: string;

  @Prop({
    trim: true,
    maxlength: 30,
    default: '1900 2224',
  })
  hotline?: string;

  @Prop({
    type: String,
    enum: BranchStatus,
    default: BranchStatus.ACTIVE,
    required: true,
  })
  branchStatus!: BranchStatus;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ branchName: 1 });
BranchSchema.index({ branchStatus: 1 });
