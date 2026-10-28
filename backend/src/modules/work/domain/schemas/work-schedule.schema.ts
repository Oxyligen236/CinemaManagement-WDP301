import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type WorkScheduleDocument = HydratedDocument<WorkSchedule>;

@Schema({
  collection: 'work_schedules',
  timestamps: true,
})
export class WorkSchedule {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  scheduleId!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  shiftName!: string;

  @Prop({
    required: true,
  })
  startTime!: string;

  @Prop({
    required: true,
  })
  endTime!: string;

  @Prop({ required: true, min: 1, max: 600 })
  durationInMinutes!: number;

  @Prop({ required: true, default: false })
  isOvernight!: boolean;

  @Prop({
    type: [String],
    default: [],
  })
  userIds!: string[];

  @Prop({
    trim: true,
  })
  branchId?: string;

  @Prop({ trim: true, maxlength: 500 })
  note?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const WorkScheduleSchema = SchemaFactory.createForClass(WorkSchedule);

WorkScheduleSchema.index({ startTime: 1, endTime: 1 });
WorkScheduleSchema.index({ userIds: 1 });
