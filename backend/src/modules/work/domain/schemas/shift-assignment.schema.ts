import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ShiftAssignmentDocument = HydratedDocument<ShiftAssignment>;

@Schema({ collection: 'shift_assignments', timestamps: true })
export class ShiftAssignment {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'WorkSchedule',
    required: true,
    index: true,
  })
  scheduleId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  date!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
}

export const ShiftAssignmentSchema =
  SchemaFactory.createForClass(ShiftAssignment);

ShiftAssignmentSchema.index(
  { userId: 1, scheduleId: 1, date: 1 },
  { unique: true },
);
ShiftAssignmentSchema.index({ branchId: 1, date: 1, scheduleId: 1 });
