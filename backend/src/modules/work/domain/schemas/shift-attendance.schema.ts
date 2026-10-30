import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type ShiftAttendanceDocument = HydratedDocument<ShiftAttendance>;
export enum ShiftAttendanceStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABSENT = 'ABSENT',
}

@Schema({ collection: 'shift_attendances', timestamps: true })
export class ShiftAttendance {
  @Prop({ required: true, unique: true, default: () => randomUUID() })
  attendanceId!: string;
  @Prop({ required: true }) scheduleId!: string;
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) branchId!: string;
  @Prop({ required: true }) date!: string;
  @Prop() checkInAt?: Date;
  @Prop() checkOutAt?: Date;
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
