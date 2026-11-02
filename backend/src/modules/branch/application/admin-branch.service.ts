import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RoomStatus, SeatStatus, SeatType, BranchStatus } from '@prisma/client';
import { BRANCH_MESSAGES, canDeactivateBranch } from '../domain/branch.rules';
import {
  AdminBranchQueryDto,
  CreateBranchDto,
  UpdateBranchDto,
} from './dto/req.dto';
import {
  AdminBranchDetailResponseDto,
  AdminBranchItemDto,
  AdminBranchListResponseDto,
  AdminBranchMutationResponseDto,
  AdminBranchRoomItemDto,
} from './dto/res.dto';

@Injectable()
export class AdminBranchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UC08 Step 1 & 2: Danh sách chi nhánh cho Admin kèm thống kê toàn chuỗi và tìm kiếm / lọc
   */
  async listBranches(
    query: AdminBranchQueryDto,
  ): Promise<AdminBranchListResponseDto> {
    return this.guard(async () => {
      const allBranches = await this.prisma.branch.findMany({
        orderBy: [{ createdAt: 'desc' }, { branchName: 'asc' }],
      });

      const allEnriched = await this.enrichBranches(allBranches);

      const chainStats = {
        totalBranches: allEnriched.length,
        activeBranches: allEnriched.filter(
          (b) => b.branchStatus === BranchStatus.ACTIVE,
        ).length,
        maintenanceBranches: allEnriched.filter(
          (b) => b.branchStatus === BranchStatus.MAINTENANCE,
        ).length,
        inactiveBranches: allEnriched.filter(
          (b) => b.branchStatus === BranchStatus.INACTIVE,
        ).length,
        totalRooms: allEnriched.reduce((acc, b) => acc + b.totalRooms, 0),
        activeRooms: allEnriched.reduce((acc, b) => acc + b.activeRooms, 0),
        totalSeats: allEnriched.reduce((acc, b) => acc + b.totalSeats, 0),
        availableSeats: allEnriched.reduce(
          (acc, b) => acc + b.availableSeats,
          0,
        ),
      };

      let filtered = allEnriched;
      if (query.branchStatus) {
        filtered = filtered.filter(
          (b) => b.branchStatus === (query.branchStatus as any),
        );
      }
      if (query.search) {
        const kw = query.search.toLowerCase();
        filtered = filtered.filter(
          (b) =>
            b.branchName.toLowerCase().includes(kw) ||
            b.address.toLowerCase().includes(kw) ||
            (b.hotline ?? '').toLowerCase().includes(kw),
        );
      }

      return {
        branches: filtered,
        total: filtered.length,
        chainStats,
      };
    });
  }

  /**
   * Xem chi tiết 1 chi nhánh kèm danh sách các phòng chiếu & thống kê ghế của chi nhánh đó
   */
  async getBranchDetail(
    branchId: string,
  ): Promise<AdminBranchDetailResponseDto> {
    return this.guard(async () => {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      const [enrichedBranches, rooms] = await Promise.all([
        this.enrichBranches([branch]),
        this.prisma.room.findMany({
          where: { branchId },
          orderBy: { roomName: 'asc' },
        }),
      ]);

      const roomSummaries = await this.enrichRooms(rooms);

      return {
        branch: enrichedBranches[0],
        rooms: roomSummaries,
      };
    });
  }

  /**
   * UC08 Step 3-5: Tạo chi nhánh rạp mới (MSG04)
   */
  async createBranch(
    input: CreateBranchDto,
  ): Promise<AdminBranchMutationResponseDto> {
    return this.guard(async () => {
      const duplicate = await this.prisma.branch.findFirst({
        where: {
          branchName: { equals: input.branchName.trim(), mode: 'insensitive' },
        },
      });

      if (duplicate) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: BRANCH_MESSAGES.BRANCH_NAME_EXISTS,
          fields: ['branchName'],
        });
      }

      const created = await this.prisma.branch.create({
        data: {
          branchName: input.branchName.trim(),
          address: input.address.trim(),
          hotline: input.hotline?.trim() || '1900 2224',
          branchStatus:
            (input.branchStatus as BranchStatus) ?? BranchStatus.ACTIVE,
        },
      });

      const [enriched] = await this.enrichBranches([created]);

      return {
        message: BRANCH_MESSAGES.MSG04_CREATED,
        branch: enriched,
      };
    });
  }

  /**
   * UC08 Step 3-5: Cập nhật thông tin hoặc trạng thái chi nhánh (MSG03).
   * Kiểm tra BR-ADM-03 nếu chuyển trạng thái sang INACTIVE.
   */
  async updateBranch(
    branchId: string,
    input: UpdateBranchDto,
  ): Promise<AdminBranchMutationResponseDto> {
    return this.guard(async () => {
      if (Object.keys(input).length === 0) {
        throw new BadRequestException(BRANCH_MESSAGES.MSG02_REQUIRED);
      }

      const existing = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!existing) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      if (
        input.branchName &&
        input.branchName.toLowerCase() !== existing.branchName.toLowerCase()
      ) {
        const duplicate = await this.prisma.branch.findFirst({
          where: {
            id: { not: branchId },
            branchName: {
              equals: input.branchName.trim(),
              mode: 'insensitive',
            },
          },
        });

        if (duplicate) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: BRANCH_MESSAGES.BRANCH_NAME_EXISTS,
            fields: ['branchName'],
          });
        }
      }

      if (
        input.branchStatus === (BranchStatus.INACTIVE as any) &&
        existing.branchStatus !== BranchStatus.INACTIVE
      ) {
        await this.assertBranchCanBeDeactivated(branchId);
      }

      const data: any = {};
      if (input.branchName !== undefined)
        data.branchName = input.branchName.trim();
      if (input.address !== undefined) data.address = input.address.trim();
      if (input.hotline !== undefined)
        data.hotline = input.hotline.trim() || '1900 2224';
      if (input.branchStatus !== undefined)
        data.branchStatus = input.branchStatus;

      const updated = await this.prisma.branch.update({
        where: { id: branchId },
        data,
      });

      const [enriched] = await this.enrichBranches([updated]);

      return {
        message: BRANCH_MESSAGES.MSG03_UPDATED,
        branch: enriched,
      };
    });
  }

  /**
   * UC08 Step 3-5 & AF-3 (BR-ADM-03): Vô hiệu hóa (Deactivate / Soft Delete) chi nhánh.
   */
  async deactivateBranch(
    branchId: string,
  ): Promise<AdminBranchMutationResponseDto> {
    return this.guard(async () => {
      const existing = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!existing) {
        throw new NotFoundException(BRANCH_MESSAGES.BRANCH_NOT_FOUND);
      }

      await this.assertBranchCanBeDeactivated(branchId);

      const updated = await this.prisma.branch.update({
        where: { id: branchId },
        data: { branchStatus: BranchStatus.INACTIVE },
      });

      const [enriched] = await this.enrichBranches([updated]);

      return {
        message: BRANCH_MESSAGES.MSG03_UPDATED,
        branch: enriched,
      };
    });
  }

  /**
   * UC22 & UC23: Danh sách chi nhánh đang hoạt động cho khách (Guest / Public)
   */
  async listPublicBranches(search?: string) {
    return this.guard(async () => {
      const where: any = { branchStatus: BranchStatus.ACTIVE };
      if (search && search.trim()) {
        where.OR = [
          { branchName: { contains: search.trim(), mode: 'insensitive' } },
          { address: { contains: search.trim(), mode: 'insensitive' } },
        ];
      }

      const branches = await this.prisma.branch.findMany({
        where,
        orderBy: { branchName: 'asc' },
      });

      const enriched = await this.enrichBranches(branches);
      return {
        branches: enriched,
        total: enriched.length,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers

  private async assertBranchCanBeDeactivated(branchId: string): Promise<void> {
    const rooms = await this.prisma.room.findMany({
      where: { branchId },
      select: { id: true, roomName: true, roomStatus: true },
    });

    const activeRooms = rooms.filter(
      (r: any) => r.roomStatus === RoomStatus.AVAILABLE,
    );
    const roomIds = rooms.map((r: any) => r.id);

    const upcomingShowtimesCount =
      roomIds.length > 0
        ? await this.prisma.showtime.count({
            where: {
              roomId: { in: roomIds },
              endTime: { gt: new Date() },
            },
          })
        : 0;

    if (!canDeactivateBranch(activeRooms.length, upcomingShowtimesCount)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: BRANCH_MESSAGES.MSG06_CANNOT_DEACTIVATE,
        details: {
          activeRoomsCount: activeRooms.length,
          activeRoomNames: activeRooms.map((r: any) => r.roomName),
          upcomingShowtimesCount,
        },
      });
    }
  }

  private async enrichBranches(branches: any[]): Promise<AdminBranchItemDto[]> {
    if (branches.length === 0) return [];

    const branchIds = branches.map((b) => b.id);
    const rooms = await this.prisma.room.findMany({
      where: { branchId: { in: branchIds } },
      select: { id: true, roomName: true, roomStatus: true, branchId: true },
    });

    const roomIds = rooms.map((r: any) => r.id);
    const now = new Date();

    const [seats, showtimes] = await Promise.all([
      roomIds.length > 0
        ? this.prisma.seat.findMany({
            where: { roomId: { in: roomIds } },
            select: { roomId: true, seatType: true, status: true },
          })
        : Promise.resolve([]),
      roomIds.length > 0
        ? this.prisma.showtime.findMany({
            where: {
              roomId: { in: roomIds },
              endTime: { gt: now },
            },
            select: { roomId: true },
          })
        : Promise.resolve([]),
    ]);

    const seatStatsByRoom = new Map<string, any>();
    for (const seat of seats) {
      let stat = seatStatsByRoom.get(seat.roomId);
      if (!stat) {
        stat = {
          totalSeats: 0,
          availableSeats: 0,
          brokenSeats: 0,
          standardSeats: 0,
          vipSeats: 0,
          coupleSeats: 0,
        };
        seatStatsByRoom.set(seat.roomId, stat);
      }
      stat.totalSeats += 1;
      if (seat.status === SeatStatus.AVAILABLE) stat.availableSeats += 1;
      else stat.brokenSeats += 1;
      if (seat.seatType === SeatType.STANDARD) stat.standardSeats += 1;
      else if (seat.seatType === SeatType.VIP) stat.vipSeats += 1;
      else if (seat.seatType === SeatType.COUPLE) stat.coupleSeats += 1;
    }

    const showtimeCountByRoom = new Map<string, number>();
    for (const st of showtimes) {
      showtimeCountByRoom.set(
        st.roomId,
        (showtimeCountByRoom.get(st.roomId) ?? 0) + 1,
      );
    }

    const roomsByBranch = new Map<string, any[]>();
    for (const room of rooms) {
      const list = roomsByBranch.get(room.branchId) ?? [];
      list.push(room);
      roomsByBranch.set(room.branchId, list);
    }

    return branches.map((branch) => {
      const branchRooms = roomsByBranch.get(branch.id) ?? [];
      const totalRooms = branchRooms.length;
      const activeRooms = branchRooms.filter(
        (r) => r.roomStatus === RoomStatus.AVAILABLE,
      ).length;
      const maintenanceRooms = branchRooms.filter(
        (r) => r.roomStatus !== RoomStatus.AVAILABLE,
      ).length;

      let totalSeats = 0;
      let availableSeats = 0;
      let brokenSeats = 0;
      let standardSeats = 0;
      let vipSeats = 0;
      let coupleSeats = 0;
      let upcomingShowtimesCount = 0;

      for (const room of branchRooms) {
        const seatStat = seatStatsByRoom.get(room.id);
        totalSeats += seatStat?.totalSeats ?? 0;
        availableSeats += seatStat?.availableSeats ?? 0;
        brokenSeats += seatStat?.brokenSeats ?? 0;
        standardSeats += seatStat?.standardSeats ?? 0;
        vipSeats += seatStat?.vipSeats ?? 0;
        coupleSeats += seatStat?.coupleSeats ?? 0;
        upcomingShowtimesCount += showtimeCountByRoom.get(room.id) ?? 0;
      }

      return {
        branchId: branch.id,
        branchName: branch.branchName,
        address: branch.address,
        hotline: branch.hotline || '1900 2224',
        branchStatus: branch.branchStatus,
        totalRooms,
        activeRooms,
        maintenanceRooms,
        totalSeats,
        availableSeats,
        brokenSeats,
        standardSeats,
        vipSeats,
        coupleSeats,
        upcomingShowtimesCount,
        canDeactivate: canDeactivateBranch(activeRooms, upcomingShowtimesCount),
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      };
    });
  }

  private async enrichRooms(rooms: any[]): Promise<AdminBranchRoomItemDto[]> {
    if (rooms.length === 0) return [];

    const roomIds = rooms.map((r) => r.id);
    const now = new Date();

    const [seats, showtimes] = await Promise.all([
      this.prisma.seat.findMany({
        where: { roomId: { in: roomIds } },
        select: { roomId: true, seatType: true, status: true },
      }),
      this.prisma.showtime.findMany({
        where: {
          roomId: { in: roomIds },
          endTime: { gt: now },
        },
        select: { roomId: true },
      }),
    ]);

    const seatStatsByRoom = new Map<string, any>();
    for (const seat of seats) {
      let stat = seatStatsByRoom.get(seat.roomId);
      if (!stat) {
        stat = {
          totalSeats: 0,
          availableSeats: 0,
          brokenSeats: 0,
          standardSeats: 0,
          vipSeats: 0,
          coupleSeats: 0,
        };
        seatStatsByRoom.set(seat.roomId, stat);
      }
      stat.totalSeats += 1;
      if (seat.status === SeatStatus.AVAILABLE) stat.availableSeats += 1;
      else stat.brokenSeats += 1;
      if (seat.seatType === SeatType.STANDARD) stat.standardSeats += 1;
      else if (seat.seatType === SeatType.VIP) stat.vipSeats += 1;
      else if (seat.seatType === SeatType.COUPLE) stat.coupleSeats += 1;
    }

    const showtimeCountByRoom = new Map<string, number>();
    for (const st of showtimes) {
      showtimeCountByRoom.set(
        st.roomId,
        (showtimeCountByRoom.get(st.roomId) ?? 0) + 1,
      );
    }

    return rooms.map((room) => {
      const stat = seatStatsByRoom.get(room.id);
      return {
        roomId: room.id,
        roomName: room.roomName,
        roomStatus: room.roomStatus,
        branchId: room.branchId,
        totalSeats: stat?.totalSeats ?? 0,
        availableSeats: stat?.availableSeats ?? 0,
        brokenSeats: stat?.brokenSeats ?? 0,
        standardSeats: stat?.standardSeats ?? 0,
        vipSeats: stat?.vipSeats ?? 0,
        coupleSeats: stat?.coupleSeats ?? 0,
        upcomingShowtimesCount: showtimeCountByRoom.get(room.id) ?? 0,
      };
    });
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        BRANCH_MESSAGES.SERVICE_UNAVAILABLE,
      );
    }
  }
}
