import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ShiftAttendanceDocument = HydratedDocument<ShiftAttendance>;
export enum ShiftAttendanceStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABSENT = 'ABSENT',
}

@Schema({ collection: 'shift_attendances', timestamps: true })
export class ShiftAttendance {
  _id!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'WorkSchedule',
    required: true,
  })
  scheduleId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  date!: string;

  @Prop()
  checkInAt?: Date;

  @Prop()
  checkOutAt?: Date;

  @Prop({
    enum: ShiftAttendanceStatus,
    default: ShiftAttendanceStatus.IN_PROGRESS,
  })
  status!: ShiftAttendanceStatus;
}

export const ShiftAttendanceSchema =
  SchemaFactory.createForClass(ShiftAttendance);

ShiftAttendanceSchema.index(
  { userId: 1, scheduleId: 1, date: 1 },
  { unique: true },
);
