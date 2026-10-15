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

  @Prop({
    required: true,
  })
  startTime!: Date;

  @Prop({
    required: true,
  })
  endTime!: Date;

  @Prop({
    type: [String],
    default: [],
  })
  userIds!: string[];

  @Prop({
    trim: true,
  })
  branchId?: string;
}

export const WorkScheduleSchema = SchemaFactory.createForClass(WorkSchedule);

WorkScheduleSchema.index({ startTime: 1, endTime: 1 });
WorkScheduleSchema.index({ userIds: 1 });
