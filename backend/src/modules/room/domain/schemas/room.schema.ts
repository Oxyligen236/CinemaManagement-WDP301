import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { RoomStatus } from '../enums/room-status.enum';

export type RoomDocument = HydratedDocument<Room>;

@Schema({
  collection: 'rooms',
  timestamps: true,
})
export class Room {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  roomName!: string;

  @Prop({
    type: String,
    enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
    required: true,
  })
  roomStatus!: RoomStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branchId!: Types.ObjectId;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ branchId: 1 });
RoomSchema.index({ roomStatus: 1 });
