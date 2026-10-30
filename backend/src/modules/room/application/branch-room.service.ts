import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  Role,
  BranchStatus,
  SeatShowtimeStatus,
  RoomStatus,
  SeatStatus,
  SeatType,
} from '@prisma/client';
import { ROOM_MESSAGES } from '../domain/room.rules';
import {
  BranchRoomQueryDto,
  CreateBranchRoomDto,
  ReplaceRoomLayoutDto,
  UpdateBranchRoomDto,
  UpdateRoomSeatsDto,
} from './dto/req.dto';
import {
  BranchRoomDetailResponseDto,
  BranchRoomListResponseDto,
  BranchRoomMutationResponseDto,
  BranchRoomSeatsMutationResponseDto,
  BranchRoomSummaryDto,
  RoomManagerBranchDto,
  RoomSeatItemDto,
  RoomUpcomingShowtimeDto,
} from './dto/res.dto';

@Injectable()
export class BranchRoomService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main flow bước 1: Danh sách các phòng chiếu thuộc chi nhánh của Branch Manager
   */
  async listRooms(
    managerUserId: string | undefined,
    query: BranchRoomQueryDto,
  ): Promise<BranchRoomListResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);

      const where: any = {
        branchId: branch.branchId,
      };
      if (query.roomStatus) {
        where.roomStatus = query.roomStatus;
      }
      if (query.search) {
        where.roomName = { contains: query.search.trim(), mode: 'insensitive' };
      }

      const rooms = await this.prisma.room.findMany({
        where,
        orderBy: { roomName: 'asc' },
      });

      const summaries = await this.buildRoomSummaries(rooms);

      return {
        branch,
        rooms: summaries,
        total: summaries.length,
      };
    });
  }

  /**
   * Main flow bước 2: Xem chi tiết 1 phòng chiếu (danh sách ghế, sơ đồ ghế, suất chiếu sắp tới)
   */
  async getRoomDetail(
    managerUserId: string | undefined,
    roomId: string,
  ): Promise<BranchRoomDetailResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);

      const room = await this.prisma.room.findFirst({
        where: { id: roomId, branchId: branch.branchId },
      });

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const [summaries, seatsWithLockInfo, upcomingShowtimes] =
        await Promise.all([
          this.buildRoomSummaries([room]),
          this.getRoomSeatsWithUpcomingBookingFlag(room.id),
          this.getUpcomingShowtimesForRoom(room.id),
        ]);

      return {
        branch,
        room: summaries[0],
        seats: seatsWithLockInfo,
        upcomingShowtimes,
      };
    });
  }

  /**
   * Main flow bước 3-5: Tạo phòng chiếu mới và sinh lưới ghế mặc định (MSG04)
   */
  async createRoom(
    managerUserId: string | undefined,
    input: CreateBranchRoomDto,
  ): Promise<BranchRoomMutationResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);

      const duplicate = await this.prisma.room.findFirst({
        where: {
          branchId: branch.branchId,
          roomName: { equals: input.roomName.trim(), mode: 'insensitive' },
        },
      });

      if (duplicate) {
        throw new ConflictException(ROOM_MESSAGES.ROOM_NAME_EXISTS);
      }

      const created = await this.prisma.room.create({
        data: {
          roomName: input.roomName.trim(),
          roomStatus: RoomStatus.AVAILABLE,
          branchId: branch.branchId,
        },
      });

      if (input.customSeats && input.customSeats.length > 0) {
        const seatDocs = input.customSeats.map((s) => ({
          roomId: created.id,
          rowPosition: s.rowPosition.trim().toUpperCase(),
          columnPosition: s.columnPosition,
          seatType: s.seatType as SeatType,
          status: s.status ?? SeatStatus.AVAILABLE,
        }));
        await this.prisma.seat.createMany({ data: seatDocs });
      } else {
        const rows = input.rowCount ?? 6;
        const cols = input.columnsPerRow ?? 10;
        await this.generateDefaultSeatsForRoom(created.id, rows, cols);
      }

      const [summary] = await this.buildRoomSummaries([created]);

      return {
        message: ROOM_MESSAGES.MSG04_ROOM_CREATED,
        room: summary,
      };
    });
  }

  /**
   * Thay đổi toàn bộ bố trí sơ đồ ghế (Layout) của phòng chiếu.
   * Nếu phòng đang có suất chiếu sắp tới đã bán vé, chặn không cho thay đổi.
   */
  async replaceRoomLayout(
    managerUserId: string | undefined,
    roomId: string,
    input: ReplaceRoomLayoutDto,
  ): Promise<BranchRoomMutationResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);
      if (branch.branchStatus !== BranchStatus.ACTIVE) {
        throw new BadRequestException(ROOM_MESSAGES.BRANCH_NOT_ACTIVE);
      }

      const room = await this.prisma.room.findFirst({
        where: { id: roomId, branchId: branch.branchId },
      });

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const upcomingShowtimes = await this.prisma.showtime.findMany({
        where: {
          roomId: room.id,
          endTime: { gt: new Date() },
        },
        select: { id: true },
      });

      const upcomingShowtimeIds = upcomingShowtimes.map((s) => s.id);

      if (upcomingShowtimeIds.length > 0) {
        const soldCount = await this.prisma.seatShowtime.count({
          where: {
            showtimeId: { in: upcomingShowtimeIds },
            seatStatus: {
              in: [SeatShowtimeStatus.BOOKED, SeatShowtimeStatus.RESERVED],
            },
          },
        });

        if (soldCount > 0) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: ROOM_MESSAGES.MSG07_CANNOT_CHANGE_LAYOUT_WITH_BOOKED_TICKETS,
          });
        }

        // Suất chiếu chưa có vé nào bán -> Xóa các SeatShowtime cũ
        await this.prisma.seatShowtime.deleteMany({
          where: {
            showtimeId: { in: upcomingShowtimeIds },
          },
        });
      }

      // Xóa toàn bộ ghế cũ của phòng
      await this.prisma.seat.deleteMany({ where: { roomId: room.id } });

      // Chèn danh sách ghế mới
      const seatDocs = input.seats.map((s) => ({
        roomId: room.id,
        rowPosition: s.rowPosition.trim().toUpperCase(),
        columnPosition: s.columnPosition,
        seatType: s.seatType as SeatType,
        status: s.status ?? SeatStatus.AVAILABLE,
      }));

      await this.prisma.seat.createMany({
        data: seatDocs,
      });

      // Tái tạo lại SeatShowtime cho các suất chiếu tương lai chưa bán vé
      if (upcomingShowtimeIds.length > 0) {
        const insertedSeats = await this.prisma.seat.findMany({
          where: { roomId: room.id },
          select: { id: true },
        });

        const seatShowtimesToInsert: {
          showtimeId: string;
          seatId: string;
          seatStatus: SeatShowtimeStatus;
        }[] = [];

        for (const stId of upcomingShowtimeIds) {
          for (const s of insertedSeats) {
            seatShowtimesToInsert.push({
              showtimeId: stId,
              seatId: s.id,
              seatStatus: SeatShowtimeStatus.EMPTY,
            });
          }
        }
        if (seatShowtimesToInsert.length > 0) {
          await this.prisma.seatShowtime.createMany({
            data: seatShowtimesToInsert,
          });
        }
      }

      const [summary] = await this.buildRoomSummaries([room]);

      return {
        message: ROOM_MESSAGES.MSG08_LAYOUT_REPLACED,
        room: summary,
      };
    });
  }

  /**
   * Main flow bước 3-5: Cập nhật trạng thái phòng chiếu (AVAILABLE <-> MAINTENANCE) hoặc đổi tên phòng.
   * BR-BRM-06 / AF-1: Không cho phép chuyển sang MAINTENANCE nếu phòng đang có suất chiếu sắp diễn ra.
   */
  async updateRoom(
    managerUserId: string | undefined,
    roomId: string,
    input: UpdateBranchRoomDto,
  ): Promise<BranchRoomMutationResponseDto> {
    return this.guard(async () => {
      if (input.roomName === undefined && input.roomStatus === undefined) {
        throw new BadRequestException(ROOM_MESSAGES.MSG01_INVALID_INPUT);
      }

      const branch = await this.resolveManagerBranch(managerUserId);
      const room = await this.prisma.room.findFirst({
        where: { id: roomId, branchId: branch.branchId },
      });

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      if (
        input.roomName &&
        input.roomName.toLowerCase() !== room.roomName.toLowerCase()
      ) {
        const duplicate = await this.prisma.room.findFirst({
          where: {
            branchId: branch.branchId,
            id: { not: roomId },
            roomName: { equals: input.roomName.trim(), mode: 'insensitive' },
          },
        });

        if (duplicate) {
          throw new ConflictException(ROOM_MESSAGES.ROOM_NAME_EXISTS);
        }
      }

      if (
        input.roomStatus === (RoomStatus.MAINTENANCE as any) &&
        room.roomStatus !== RoomStatus.MAINTENANCE
      ) {
        const upcomingShowtimesCount = await this.prisma.showtime.count({
          where: {
            roomId,
            endTime: { gt: new Date() },
          },
        });

        if (upcomingShowtimesCount > 0) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: ROOM_MESSAGES.MSG05_ROOM_HAS_UPCOMING_SHOWTIMES,
            details: { upcomingShowtimesCount },
          });
        }
      }

      const data: any = {};
      if (input.roomName !== undefined) data.roomName = input.roomName.trim();
      if (input.roomStatus !== undefined) data.roomStatus = input.roomStatus;

      const updated = await this.prisma.room.update({
        where: { id: roomId },
        data,
      });

      const [summary] = await this.buildRoomSummaries([updated]);

      return {
        message: ROOM_MESSAGES.MSG04_ROOM_UPDATED,
        room: summary,
      };
    });
  }

  /**
   * Main flow bước 3-5: Cập nhật trạng thái ghế (AVAILABLE <-> MAINTENANCE/BLOCKED) hoặc loại ghế.
   */
  async updateSeats(
    managerUserId: string | undefined,
    roomId: string,
    input: UpdateRoomSeatsDto,
  ): Promise<BranchRoomSeatsMutationResponseDto> {
    return this.guard(async () => {
      if (input.status === undefined && input.seatType === undefined) {
        throw new BadRequestException(ROOM_MESSAGES.MSG01_INVALID_INPUT);
      }

      const branch = await this.resolveManagerBranch(managerUserId);
      const room = await this.prisma.room.findFirst({
        where: { id: roomId, branchId: branch.branchId },
      });

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const targetSeats = await this.prisma.seat.findMany({
        where: { id: { in: input.seatIds }, roomId },
      });

      if (targetSeats.length === 0) {
        throw new NotFoundException(ROOM_MESSAGES.SEAT_NOT_FOUND);
      }

      const validSeatIds = targetSeats.map((s: any) => s.id);
      const validSeatIdSet = new Set(validSeatIds);

      const isMarkingBroken =
        input.status === (SeatStatus.MAINTENANCE as any) ||
        input.status === (SeatStatus.BLOCKED as any);

      if (isMarkingBroken) {
        const upcomingShowtimes = await this.prisma.showtime.findMany({
          where: {
            roomId,
            endTime: { gt: new Date() },
          },
          select: { id: true },
        });

        const upcomingShowtimeIds = upcomingShowtimes.map((s: any) => s.id);

        if (upcomingShowtimeIds.length > 0) {
          const bookedSeatEntries = await this.prisma.seatShowtime.findMany({
            where: {
              showtimeId: { in: upcomingShowtimeIds },
              seatId: { in: validSeatIds },
              seatStatus: {
                in: [SeatShowtimeStatus.BOOKED, SeatShowtimeStatus.RESERVED],
              },
            },
            select: { seatId: true },
          });

          if (bookedSeatEntries.length > 0) {
            const bookedSeatIds = Array.from(
              new Set(bookedSeatEntries.map((e: any) => e.seatId)),
            );
            const bookedSeatLabels = targetSeats
              .filter((s: any) => bookedSeatIds.includes(s.id))
              .map((s: any) => `${s.rowPosition}${s.columnPosition}`);

            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              message: ROOM_MESSAGES.MSG06_SEAT_SOLD_IN_UPCOMING_SHOWTIME,
              details: {
                bookedSeats: bookedSeatLabels,
                bookedSeatIds,
              },
            });
          }
        }
      }

      const updateData: any = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.seatType !== undefined) updateData.seatType = input.seatType;

      await this.prisma.seat.updateMany({
        where: { id: { in: validSeatIds } },
        data: updateData,
      });

      const isMarkingAvailable = input.status === (SeatStatus.AVAILABLE as any);
      if (isMarkingAvailable) {
        const upcomingShowtimes = await this.prisma.showtime.findMany({
          where: {
            roomId,
            endTime: { gt: new Date() },
          },
          select: { id: true },
        });

        for (const st of upcomingShowtimes) {
          const existingEntries = await this.prisma.seatShowtime.findMany({
            where: {
              showtimeId: st.id,
              seatId: { in: validSeatIds },
            },
            select: { seatId: true },
          });

          const existingSet = new Set(existingEntries.map((e: any) => e.seatId));
          const missingSeatIds = validSeatIds.filter(
            (id: any) => !existingSet.has(id),
          );

          if (missingSeatIds.length > 0) {
            await this.prisma.seatShowtime.createMany({
              data: missingSeatIds.map((seatId: any) => ({
                showtimeId: st.id,
                seatId,
                seatStatus: SeatShowtimeStatus.EMPTY,
              })),
            });
          }
        }
      }

      const [summaries, seatsWithLockInfo] = await Promise.all([
        this.buildRoomSummaries([room]),
        this.getRoomSeatsWithUpcomingBookingFlag(room.id),
      ]);

      const updatedSeatDtos = seatsWithLockInfo.filter((s: any) =>
        validSeatIdSet.has(s.seatId),
      );

      return {
        message: ROOM_MESSAGES.MSG04_SEATS_UPDATED,
        updatedCount: updatedSeatDtos.length,
        room: summaries[0],
        seats: updatedSeatDtos,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers

  private async buildRoomSummaries(rooms: any[]): Promise<BranchRoomSummaryDto[]> {
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
      showtimeCountByRoom.set(st.roomId, (showtimeCountByRoom.get(st.roomId) ?? 0) + 1);
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

  private async getRoomSeatsWithUpcomingBookingFlag(
    roomId: string,
  ): Promise<RoomSeatItemDto[]> {
    const [seats, upcomingShowtimes] = await Promise.all([
      this.prisma.seat.findMany({
        where: { roomId },
        orderBy: [{ rowPosition: 'asc' }, { columnPosition: 'asc' }],
      }),
      this.prisma.showtime.findMany({
        where: { roomId, endTime: { gt: new Date() } },
        select: { id: true },
      }),
    ]);

    const upcomingShowtimeIds = upcomingShowtimes.map((s: any) => s.id);
    let bookedSeatIds = new Set<string>();

    if (upcomingShowtimeIds.length > 0) {
      const bookedEntries = await this.prisma.seatShowtime.findMany({
        where: {
          showtimeId: { in: upcomingShowtimeIds },
          seatStatus: {
            in: [SeatShowtimeStatus.BOOKED, SeatShowtimeStatus.RESERVED],
          },
        },
        select: { seatId: true },
      });
      bookedSeatIds = new Set(bookedEntries.map((e: any) => e.seatId));
    }

    return seats.map((seat: any) => ({
      seatId: seat.id,
      roomId: seat.roomId,
      rowPosition: seat.rowPosition,
      columnPosition: seat.columnPosition,
      seatLabel: `${seat.rowPosition}${seat.columnPosition}`,
      seatType: seat.seatType as any,
      status: seat.status as any,
      isBroken:
        seat.status === SeatStatus.MAINTENANCE ||
        seat.status === SeatStatus.BLOCKED,
      hasUpcomingBookedTicket: bookedSeatIds.has(seat.id),
    }));
  }

  private async getUpcomingShowtimesForRoom(
    roomId: string,
  ): Promise<RoomUpcomingShowtimeDto[]> {
    const showtimes = await this.prisma.showtime.findMany({
      where: {
        roomId,
        endTime: { gt: new Date() },
      },
      include: {
        movie: {
          select: { id: true, movieName: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return showtimes.map((st: any) => ({
      showtimeId: st.id,
      movieId: st.movieId,
      movieName: st.movie?.movieName ?? 'Phim đang xếp lịch',
      startTime: st.startTime,
      endTime: st.endTime,
    }));
  }

  private async generateDefaultSeatsForRoom(
    roomId: string,
    rowCount: number,
    columnsPerRow: number,
  ) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const seatDocs: {
      roomId: string;
      rowPosition: string;
      columnPosition: number;
      seatType: SeatType;
      status: SeatStatus;
    }[] = [];

    for (let r = 0; r < rowCount; r++) {
      const rowLabel = alphabet[r] ?? `R${r + 1}`;
      const isLastRow = r === rowCount - 1 && rowCount >= 5;
      const isVipRow = r >= Math.floor(rowCount / 2) && !isLastRow;

      for (let col = 1; col <= columnsPerRow; col++) {
        seatDocs.push({
          roomId,
          rowPosition: rowLabel,
          columnPosition: col,
          seatType: isLastRow
            ? SeatType.COUPLE
            : isVipRow
              ? SeatType.VIP
              : SeatType.STANDARD,
          status: SeatStatus.AVAILABLE,
        });
      }
    }

    if (seatDocs.length > 0) {
      await this.prisma.seat.createMany({
        data: seatDocs,
      });
    }
  }

  private async resolveManagerBranch(
    managerUserId?: string,
  ): Promise<RoomManagerBranchDto> {
    if (managerUserId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: managerUserId },
        select: { role: true, isActive: true, branchId: true },
      });

      const isManagerRole =
        manager?.role === Role.MANAGER || (manager?.role as any) === 'BRANCHMANAGER';
      if (manager && (!manager.isActive || !isManagerRole)) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập chức năng Quản lý Chi nhánh.',
        );
      }
      if (manager && manager.isActive && isManagerRole) {
        if (manager.branchId) {
          const assignedBranch = await this.prisma.branch.findUnique({
            where: { id: manager.branchId },
            select: { id: true, branchName: true, address: true, branchStatus: true },
          });

          if (assignedBranch) {
            return {
              branchId: assignedBranch.id,
              branchName: assignedBranch.branchName,
              address: assignedBranch.address,
              branchStatus: assignedBranch.branchStatus as any,
            };
          }
        }
      }
    }

    let defaultBranch = await this.prisma.branch.findFirst({
      where: { branchStatus: BranchStatus.ACTIVE },
      select: { id: true, branchName: true, address: true, branchStatus: true },
    });

    if (!defaultBranch) {
      const created = await this.prisma.branch.create({
        data: {
          branchName: 'Lotte Cinema Nam Sài Gòn',
          address:
            'Tầng 3, TTTM Lotte, số 469 đường Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7, TP.HCM',
          branchStatus: BranchStatus.ACTIVE,
        },
      });
      defaultBranch = {
        id: created.id,
        branchName: created.branchName,
        address: created.address,
        branchStatus: created.branchStatus,
      };
    }

    return {
      branchId: defaultBranch.id,
      branchName: defaultBranch.branchName,
      address: defaultBranch.address,
      branchStatus: defaultBranch.branchStatus as any,
    };
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        ROOM_MESSAGES.SERVICE_UNAVAILABLE,
      );
    }
  }
}
