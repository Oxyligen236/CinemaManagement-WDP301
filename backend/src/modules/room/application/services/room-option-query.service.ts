import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../../domain/schemas/room.schema';
import { RoomOptionResDto } from '../dto/res.dto';
import { GetRoomSchedulingInfoUsecase } from '../usecase/get-room-scheduling-info.usecase';
import { ListBranchRoomsUsecase } from '../usecase/list-branch-rooms.usecase';

type RoomLean = Pick<Room, 'roomId' | 'roomName' | 'roomStatus' | 'branchId'>;

@Injectable()
export class RoomOptionQueryService
  implements ListBranchRoomsUsecase, GetRoomSchedulingInfoUsecase
{
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
  ) {}

  async listRoomsByBranch(branchId: string): Promise<RoomOptionResDto[]> {
    const docs = (await this.roomModel
      .find({ branchId })
      .sort({ roomName: 1 })
      .lean()
      .exec()) as unknown as RoomLean[];
    return docs.map((doc) => this.toDto(doc));
  }

  async getRoomSchedulingInfo(
    roomId: string,
  ): Promise<RoomOptionResDto | null> {
    const doc = (await this.roomModel
      .findOne({ roomId })
      .lean()
      .exec()) as unknown as RoomLean | null;
    return doc ? this.toDto(doc) : null;
  }

  async getRoomSchedulingInfos(roomIds: string[]): Promise<RoomOptionResDto[]> {
    if (roomIds.length === 0) {
      return [];
    }
    const docs = (await this.roomModel
      .find({ roomId: { $in: roomIds } })
      .lean()
      .exec()) as unknown as RoomLean[];
    return docs.map((doc) => this.toDto(doc));
  }

  private toDto(doc: RoomLean): RoomOptionResDto {
    return {
      roomId: doc.roomId,
      roomName: doc.roomName,
      roomStatus: doc.roomStatus,
      branchId: doc.branchId,
    };
  }
}
