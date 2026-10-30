import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WorkScheduleDocument = HydratedDocument<WorkSchedule>;

@Schema({
  collection: 'work_schedules',
  timestamps: true,
})
export class WorkSchedule {
  _id!: Types.ObjectId;

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
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  userIds!: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
  })
  branchId?: Types.ObjectId;

  @Prop({ trim: true, maxlength: 500 })
  note?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const WorkScheduleSchema = SchemaFactory.createForClass(WorkSchedule);

WorkScheduleSchema.index({ startTime: 1, endTime: 1 });
WorkScheduleSchema.index({ userIds: 1 });
