import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { RoomStatus } from '../enums/room-status.enum';

export type RoomDocument = HydratedDocument<Room>;

@Schema({
  collection: 'rooms',
  timestamps: true,
})
export class Room {
  @Prop({
    required: true,
    unique: true,
    default: () => randomUUID(),
  })
  roomId!: string;

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
    required: true,
    trim: true,
  })
  branchId!: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ branchId: 1 });
RoomSchema.index({ roomStatus: 1 });
