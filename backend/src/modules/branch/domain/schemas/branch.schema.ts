import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { BranchStatus } from '../enums/branch-status.enum';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({
  collection: 'branches',
  timestamps: true,
})
export class Branch {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  branchId!: string;

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
