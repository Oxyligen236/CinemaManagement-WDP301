import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../../domain/schemas/room.schema';
import { RoomOptionResDto } from '../dto/res.dto';
import { GetRoomSchedulingInfoUsecase } from '../usecase/get-room-scheduling-info.usecase';
import { ListBranchRoomsUsecase } from '../usecase/list-branch-rooms.usecase';

type RoomLean = {
  _id: Types.ObjectId | string;
  roomName: string;
  roomStatus: string;
  branchId: Types.ObjectId | string;
};

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : (id as unknown as Types.ObjectId);
}

@Injectable()
export class RoomOptionQueryService
  implements ListBranchRoomsUsecase, GetRoomSchedulingInfoUsecase
{
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
  ) {}

  async listRoomsByBranch(branchId: string): Promise<RoomOptionResDto[]> {
    const branchObjId = toObjectId(branchId);
    const docs = (await this.roomModel
      .find({ branchId: branchObjId })
      .sort({ roomName: 1 })
      .lean()
      .exec()) as unknown as RoomLean[];
    return docs.map((doc) => this.toDto(doc));
  }

  async getRoomSchedulingInfo(
    roomId: string,
  ): Promise<RoomOptionResDto | null> {
    const doc = (await this.roomModel
      .findById(toObjectId(roomId))
      .lean()
      .exec()) as unknown as RoomLean | null;
    return doc ? this.toDto(doc) : null;
  }

  async getRoomSchedulingInfos(roomIds: string[]): Promise<RoomOptionResDto[]> {
    if (roomIds.length === 0) {
      return [];
    }
    const docs = (await this.roomModel
      .find({ _id: { $in: roomIds.map((id) => toObjectId(id)) } })
      .lean()
      .exec()) as unknown as RoomLean[];
    return docs.map((doc) => this.toDto(doc));
  }

  private toDto(doc: RoomLean): RoomOptionResDto {
    return RoomOptionResDto.from({
      roomId: (doc._id ?? '').toString(),
      roomName: doc.roomName,
      roomStatus: doc.roomStatus,
      branchId: (doc.branchId ?? '').toString(),
    });
  }
}
