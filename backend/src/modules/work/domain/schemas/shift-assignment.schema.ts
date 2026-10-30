import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type ShiftAssignmentDocument = HydratedDocument<ShiftAssignment>;

@Schema({ collection: 'shift_assignments', timestamps: true })
export class ShiftAssignment {
  @Prop({ required: true, unique: true, default: () => randomUUID() })
  assignmentId!: string;
  @Prop({ required: true, index: true }) scheduleId!: string;
  @Prop({ required: true, index: true }) userId!: string;
  @Prop({ required: true, index: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  date!: string;
  @Prop({ required: true, index: true }) branchId!: string;
}

export const ShiftAssignmentSchema =
  SchemaFactory.createForClass(ShiftAssignment);
ShiftAssignmentSchema.index(
  { userId: 1, scheduleId: 1, date: 1 },
  { unique: true },
);
ShiftAssignmentSchema.index({ branchId: 1, date: 1, scheduleId: 1 });
