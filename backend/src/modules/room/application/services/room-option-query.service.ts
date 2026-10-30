import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RoomOptionResDto } from '../dto/res.dto';
import { GetRoomSchedulingInfoUsecase } from '../usecase/get-room-scheduling-info.usecase';
import { ListBranchRoomsUsecase } from '../usecase/list-branch-rooms.usecase';

@Injectable()
export class RoomOptionQueryService
  implements ListBranchRoomsUsecase, GetRoomSchedulingInfoUsecase
{
  constructor(private readonly prisma: PrismaService) {}

  async listRoomsByBranch(branchId: string): Promise<RoomOptionResDto[]> {
    const docs = await this.prisma.room.findMany({
      where: { branchId },
      orderBy: { roomName: 'asc' },
    });
    return docs.map((doc) => this.toDto(doc));
  }

  async getRoomSchedulingInfo(
    roomId: string,
  ): Promise<RoomOptionResDto | null> {
    const doc = await this.prisma.room.findUnique({
      where: { id: roomId },
    });
    return doc ? this.toDto(doc) : null;
  }

  async getRoomSchedulingInfos(roomIds: string[]): Promise<RoomOptionResDto[]> {
    if (roomIds.length === 0) {
      return [];
    }
    const docs = await this.prisma.room.findMany({
      where: { id: { in: roomIds } },
    });
    return docs.map((doc) => this.toDto(doc));
  }

  private toDto(doc: any): RoomOptionResDto {
    return {
      roomId: doc.id,
      roomName: doc.roomName,
      roomStatus: doc.roomStatus,
      branchId: doc.branchId,
    };
  }
}
