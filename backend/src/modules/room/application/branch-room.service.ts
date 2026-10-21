/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { Role } from '../../user/domain/enums/role.enum';
import {
  Branch,
  BranchDocument,
} from '../../branch/domain/schemas/branch.schema';
import { BranchStatus } from '../../branch/domain/enums/branch-status.enum';
import { Movie, MovieDocument } from '../../movie/domain/schemas/movie.schema';
import {
  Showtime,
  ShowtimeDocument,
} from '../../showtime/domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../../showtime/domain/schemas/seat-showtime.schema';
import { SeatShowtimeStatus } from '../../showtime/domain/enums/seat-showtime-status.enum';
import { Room, RoomDocument } from '../domain/schemas/room.schema';
import { RoomStatus } from '../domain/enums/room-status.enum';
import { Seat, SeatDocument } from '../domain/schemas/seat.schema';
import { SeatStatus } from '../domain/enums/seat-status.enum';
import { SeatType } from '../domain/enums/seat-type.enum';
import {
  LOCKED_UPCOMING_SEAT_STATUSES,
  ROOM_MESSAGES,
  isSeatBrokenStatus,
} from '../domain/room.rules';
import {
  BranchRoomQueryDto,
  CreateBranchRoomDto,
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
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Seat.name)
    private readonly seatModel: Model<SeatDocument>,
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
    @InjectModel(Movie.name)
    private readonly movieModel: Model<MovieDocument>,
  ) {}

  /**
   * Main flow bước 1: Danh sách các phòng chiếu thuộc chi nhánh của Branch Manager
   */
  async listRooms(
    managerUserId: string | undefined,
    query: BranchRoomQueryDto,
  ): Promise<BranchRoomListResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);

      const filter: Record<string, unknown> = {
        branchId: branch.branchId,
      };
      if (query.roomStatus) {
        filter.roomStatus = query.roomStatus;
      }
      if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.roomName = new RegExp(escaped, 'i');
      }

      const rooms = await this.roomModel
        .find(filter)
        .sort({ roomName: 1 })
        .lean<Room[]>()
        .exec();

      const summaries = await this.buildRoomSummaries(rooms);

      return {
        branch,
        rooms: summaries,
        total: summaries.length,
      };
    });
  }

  /**
   * Main flow bước 2: Xem thông tin phòng chiếu kèm toàn bộ sơ đồ ghế và suất chiếu sắp tới
   */
  async getRoomDetail(
    managerUserId: string | undefined,
    roomId: string,
  ): Promise<BranchRoomDetailResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);
      const room = await this.roomModel
        .findOne({ roomId, branchId: branch.branchId })
        .lean<Room>()
        .exec();

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      // Nếu phòng chiếu chưa có bản ghi ghế nào, tự động khởi tạo lưới 6x10 mặc định
      const existingSeatCount = await this.seatModel
        .countDocuments({ roomId: room.roomId })
        .exec();
      if (existingSeatCount === 0) {
        await this.generateDefaultSeatsForRoom(room.roomId, 6, 10);
      }

      const [summaries, seatsWithLockInfo, upcomingShowtimes] =
        await Promise.all([
          this.buildRoomSummaries([room]),
          this.getRoomSeatsWithUpcomingBookingFlag(room.roomId),
          this.getUpcomingShowtimesForRoom(room.roomId),
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
   * Tạo phòng chiếu mới trong chi nhánh và tự động sinh sơ đồ ghế
   */
  async createRoom(
    managerUserId: string | undefined,
    input: CreateBranchRoomDto,
  ): Promise<BranchRoomMutationResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);
      if (branch.branchStatus !== BranchStatus.ACTIVE) {
        throw new BadRequestException(ROOM_MESSAGES.BRANCH_NOT_ACTIVE);
      }

      const duplicate = await this.roomModel
        .exists({
          branchId: branch.branchId,
          roomName: new RegExp(
            `^${input.roomName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i',
          ),
        })
        .exec();

      if (duplicate) {
        throw new ConflictException(ROOM_MESSAGES.ROOM_NAME_EXISTS);
      }

      const created = await this.roomModel.create({
        roomName: input.roomName,
        roomStatus: RoomStatus.AVAILABLE,
        branchId: branch.branchId,
      });

      const rows = input.rowCount ?? 6;
      const cols = input.columnsPerRow ?? 10;
      await this.generateDefaultSeatsForRoom(created.roomId, rows, cols);

      const [summary] = await this.buildRoomSummaries([
        created.toObject() as Room,
      ]);

      return {
        message: ROOM_MESSAGES.MSG04_ROOM_CREATED,
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
      if (Object.keys(input).length === 0) {
        throw new BadRequestException(ROOM_MESSAGES.MSG01_INVALID_INPUT);
      }

      const branch = await this.resolveManagerBranch(managerUserId);
      const room = await this.roomModel
        .findOne({ roomId, branchId: branch.branchId })
        .lean<Room>()
        .exec();

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      // BR-BRM-06 / AF-1: Nếu chuyển trạng thái phòng sang MAINTENANCE (hoặc CLOSED),
      // phải kiểm tra xem phòng có suất chiếu sắp tới hoặc đang diễn ra không.
      if (
        input.roomStatus &&
        input.roomStatus !== RoomStatus.AVAILABLE &&
        room.roomStatus === RoomStatus.AVAILABLE
      ) {
        const upcomingShowtimes = await this.getUpcomingShowtimesForRoom(
          room.roomId,
        );
        if (upcomingShowtimes.length > 0) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: ROOM_MESSAGES.MSG05_ROOM_HAS_UPCOMING_SHOWTIMES,
            upcomingShowtimes,
          });
        }
      }

      if (input.roomName && input.roomName !== room.roomName) {
        const duplicate = await this.roomModel
          .exists({
            branchId: branch.branchId,
            roomId: { $ne: roomId },
            roomName: new RegExp(
              `^${input.roomName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
              'i',
            ),
          })
          .exec();
        if (duplicate) {
          throw new ConflictException(ROOM_MESSAGES.ROOM_NAME_EXISTS);
        }
      }

      const setFields: Record<string, unknown> = {};
      if (input.roomName !== undefined) setFields.roomName = input.roomName;
      if (input.roomStatus !== undefined)
        setFields.roomStatus = input.roomStatus;

      const updated = await this.roomModel
        .findOneAndUpdate(
          { roomId, branchId: branch.branchId },
          { $set: setFields },
          { new: true, runValidators: true },
        )
        .lean<Room>()
        .exec();

      if (!updated) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const [summary] = await this.buildRoomSummaries([updated]);

      return {
        message: ROOM_MESSAGES.MSG04_ROOM_UPDATED,
        room: summary,
      };
    });
  }

  /**
   * Main flow bước 3-5: Cập nhật trạng thái ghế (AVAILABLE <-> MAINTENANCE/BLOCKED) hoặc loại ghế.
   * BR-BRM-07 / AF-2: Không cho phép đánh dấu ghế là Hỏng (MAINTENANCE/BLOCKED) nếu ghế đã được bán
   * trong một suất chiếu sắp tới.
   * AF-3: Khi chuyển ghế từ Hỏng về Khả dụng (AVAILABLE), cập nhật lại trạng thái ghế.
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
      const room = await this.roomModel
        .findOne({ roomId, branchId: branch.branchId })
        .lean<Room>()
        .exec();

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const targetSeats = await this.seatModel
        .find({
          roomId: room.roomId,
          seatId: { $in: input.seatIds },
        })
        .lean<Seat[]>()
        .exec();

      if (targetSeats.length === 0) {
        throw new BadRequestException(ROOM_MESSAGES.SEAT_NOT_FOUND);
      }

      const validSeatIds = targetSeats.map((s) => s.seatId);

      // BR-BRM-07 / AF-2: Nếu chuyển sang trạng thái Hỏng (MAINTENANCE hoặc BLOCKED),
      // kiểm tra xem có ghế nào đã bán vé trong suất chiếu sắp tới không
      if (input.status && isSeatBrokenStatus(input.status)) {
        const upcomingShowtimes = await this.showtimeModel
          .find({
            roomId: room.roomId,
            endTime: { $gt: new Date() },
          })
          .select('showtimeId')
          .lean<{ showtimeId: string }[]>()
          .exec();

        const upcomingShowtimeIds = upcomingShowtimes.map((s) => s.showtimeId);

        if (upcomingShowtimeIds.length > 0) {
          const soldSeatShowtimes = await this.seatShowtimeModel
            .find({
              showtimeId: { $in: upcomingShowtimeIds },
              seatId: { $in: validSeatIds },
              seatStatus: { $in: LOCKED_UPCOMING_SEAT_STATUSES },
            })
            .select('seatId showtimeId')
            .lean<{ seatId: string; showtimeId: string }[]>()
            .exec();

          if (soldSeatShowtimes.length > 0) {
            const lockedSeatIdSet = new Set(
              soldSeatShowtimes.map((s) => s.seatId),
            );
            const lockedLabels = targetSeats
              .filter((s) => lockedSeatIdSet.has(s.seatId))
              .map((s) => `${s.rowPosition}${s.columnPosition}`);

            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              message: `${ROOM_MESSAGES.MSG06_SEAT_SOLD_IN_UPCOMING_SHOWTIME} (Ghế: ${lockedLabels.join(', ')})`,
              lockedSeats: lockedLabels,
            });
          }

          // Nếu ghế chưa ai mua, gỡ bản ghi EMPTY khỏi các suất chiếu tương lai để khách không đặt nhầm ghế hỏng
          await this.seatShowtimeModel
            .deleteMany({
              showtimeId: { $in: upcomingShowtimeIds },
              seatId: { $in: validSeatIds },
              seatStatus: SeatShowtimeStatus.EMPTY,
            })
            .exec();
        }
      }

      const setFields: Record<string, unknown> = {};
      if (input.status !== undefined) setFields.status = input.status;
      if (input.seatType !== undefined) setFields.seatType = input.seatType;

      const updateResult = await this.seatModel
        .updateMany(
          { roomId: room.roomId, seatId: { $in: validSeatIds } },
          { $set: setFields },
        )
        .exec();

      // AF-3: Nếu khôi phục ghế về AVAILABLE, đảm bảo các suất chiếu tương lai có lại bản ghi SeatShowtime (EMPTY)
      if (input.status === SeatStatus.AVAILABLE) {
        const upcomingShowtimes = await this.showtimeModel
          .find({
            roomId: room.roomId,
            endTime: { $gt: new Date() },
          })
          .select('showtimeId')
          .lean<{ showtimeId: string }[]>()
          .exec();

        for (const st of upcomingShowtimes) {
          const existingEntries = await this.seatShowtimeModel
            .find({
              showtimeId: st.showtimeId,
              seatId: { $in: validSeatIds },
            })
            .select('seatId')
            .lean<{ seatId: string }[]>()
            .exec();

          const existingSet = new Set(existingEntries.map((e) => e.seatId));
          const missingSeatIds = validSeatIds.filter(
            (id) => !existingSet.has(id),
          );

          if (missingSeatIds.length > 0) {
            await this.seatShowtimeModel.insertMany(
              missingSeatIds.map((seatId) => ({
                showtimeId: st.showtimeId,
                seatId,
                seatStatus: SeatShowtimeStatus.EMPTY,
              })),
              { ordered: false },
            );
          }
        }
      }

      const [summaries, seatsWithLockInfo] = await Promise.all([
        this.buildRoomSummaries([room]),
        this.getRoomSeatsWithUpcomingBookingFlag(room.roomId),
      ]);

      return {
        message: ROOM_MESSAGES.MSG04_SEATS_UPDATED,
        updatedCount: updateResult.modifiedCount,
        room: summaries[0],
        seats: seatsWithLockInfo,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async buildRoomSummaries(
    rooms: Room[],
  ): Promise<BranchRoomSummaryDto[]> {
    if (rooms.length === 0) return [];
    const roomIds = rooms.map((r) => r.roomId);
    const now = new Date();

    const [seatStats, showtimeCounts] = await Promise.all([
      this.seatModel.aggregate<{
        _id: string;
        totalSeats: number;
        availableSeats: number;
        brokenSeats: number;
        standardSeats: number;
        vipSeats: number;
        coupleSeats: number;
      }>([
        { $match: { roomId: { $in: roomIds } } },
        {
          $group: {
            _id: '$roomId',
            totalSeats: { $sum: 1 },
            availableSeats: {
              $sum: {
                $cond: [{ $eq: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
              },
            },
            brokenSeats: {
              $sum: {
                $cond: [{ $ne: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
              },
            },
            standardSeats: {
              $sum: {
                $cond: [{ $eq: ['$seatType', SeatType.STANDARD] }, 1, 0],
              },
            },
            vipSeats: {
              $sum: {
                $cond: [{ $eq: ['$seatType', SeatType.VIP] }, 1, 0],
              },
            },
            coupleSeats: {
              $sum: {
                $cond: [{ $eq: ['$seatType', SeatType.COUPLE] }, 1, 0],
              },
            },
          },
        },
      ]),
      this.showtimeModel.aggregate<{
        _id: string;
        upcomingCount: number;
      }>([
        {
          $match: {
            roomId: { $in: roomIds },
            endTime: { $gt: now },
          },
        },
        {
          $group: {
            _id: '$roomId',
            upcomingCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const seatMap = new Map(seatStats.map((s) => [s._id, s]));
    const showtimeMap = new Map(
      showtimeCounts.map((s) => [s._id, s.upcomingCount]),
    );

    return rooms.map((room) => {
      const stat = seatMap.get(room.roomId);
      return {
        roomId: room.roomId,
        roomName: room.roomName,
        roomStatus: room.roomStatus,
        branchId: room.branchId,
        totalSeats: stat?.totalSeats ?? 0,
        availableSeats: stat?.availableSeats ?? 0,
        brokenSeats: stat?.brokenSeats ?? 0,
        standardSeats: stat?.standardSeats ?? 0,
        vipSeats: stat?.vipSeats ?? 0,
        coupleSeats: stat?.coupleSeats ?? 0,
        upcomingShowtimesCount: showtimeMap.get(room.roomId) ?? 0,
      };
    });
  }

  private async getRoomSeatsWithUpcomingBookingFlag(
    roomId: string,
  ): Promise<RoomSeatItemDto[]> {
    const [seats, upcomingShowtimes] = await Promise.all([
      this.seatModel
        .find({ roomId })
        .sort({ rowPosition: 1, columnPosition: 1 })
        .lean<Seat[]>()
        .exec(),
      this.showtimeModel
        .find({ roomId, endTime: { $gt: new Date() } })
        .select('showtimeId')
        .lean<{ showtimeId: string }[]>()
        .exec(),
    ]);

    const bookedSeatIds = new Set<string>();
    if (upcomingShowtimes.length > 0) {
      const lockedEntries = await this.seatShowtimeModel
        .find({
          showtimeId: { $in: upcomingShowtimes.map((s) => s.showtimeId) },
          seatStatus: { $in: LOCKED_UPCOMING_SEAT_STATUSES },
        })
        .select('seatId')
        .lean<{ seatId: string }[]>()
        .exec();

      for (const entry of lockedEntries) {
        bookedSeatIds.add(entry.seatId);
      }
    }

    return seats.map((seat) => ({
      seatId: seat.seatId,
      roomId: seat.roomId,
      rowPosition: seat.rowPosition,
      columnPosition: seat.columnPosition,
      seatLabel: `${seat.rowPosition}${seat.columnPosition}`,
      seatType: seat.seatType,
      status: seat.status,
      isBroken: isSeatBrokenStatus(seat.status),
      hasUpcomingBookedTicket: bookedSeatIds.has(seat.seatId),
    }));
  }

  private async getUpcomingShowtimesForRoom(
    roomId: string,
  ): Promise<RoomUpcomingShowtimeDto[]> {
    const showtimes = await this.showtimeModel
      .find({
        roomId,
        endTime: { $gt: new Date() },
      })
      .sort({ startTime: 1 })
      .lean<Showtime[]>()
      .exec();

    if (showtimes.length === 0) return [];

    const movieIds = Array.from(new Set(showtimes.map((s) => s.movieId)));
    const movies = await this.movieModel
      .find({ movieId: { $in: movieIds } })
      .select('movieId movieName')
      .lean<{ movieId: string; movieName: string }[]>()
      .exec();

    const movieNameMap = new Map(movies.map((m) => [m.movieId, m.movieName]));

    return showtimes.map((st) => ({
      showtimeId: st.showtimeId,
      movieId: st.movieId,
      movieName: movieNameMap.get(st.movieId) ?? 'Phim đang xếp lịch',
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
      await this.seatModel.insertMany(seatDocs, { ordered: false });
    }
  }

  private async resolveManagerBranch(
    managerUserId?: string,
  ): Promise<RoomManagerBranchDto> {
    if (managerUserId) {
      const manager = await this.userModel
        .findOne({ userId: managerUserId })
        .select('role isActive branchId')
        .lean()
        .exec();

      if (manager && manager.isActive && manager.role === Role.BRANCHMANAGER) {
        if (manager.branchId) {
          const assignedBranch = await this.branchModel
            .findOne({ branchId: manager.branchId })
            .select('branchId branchName address branchStatus')
            .lean<RoomManagerBranchDto>()
            .exec();

          if (assignedBranch) {
            return assignedBranch;
          }
        }
      } else if (
        manager &&
        manager.role !== Role.BRANCHMANAGER &&
        manager.role !== Role.ADMIN
      ) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập chức năng Quản lý Chi nhánh.',
        );
      }
    }

    let defaultBranch = await this.branchModel
      .findOne({ branchStatus: BranchStatus.ACTIVE })
      .select('branchId branchName address branchStatus')
      .lean<RoomManagerBranchDto>()
      .exec();

    if (!defaultBranch) {
      const created = await this.branchModel.create({
        branchName: 'Lotte Cinema Nam Sài Gòn',
        address:
          'Tầng 3, TTTM Lotte, số 469 đường Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7, TP.HCM',
        branchStatus: BranchStatus.ACTIVE,
      });
      defaultBranch = {
        branchId: created.branchId,
        branchName: created.branchName,
        address: created.address,
        branchStatus: created.branchStatus,
      };
    }

    return defaultBranch;
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const name =
        typeof error === 'object' && error !== null && 'name' in error
          ? String((error as { name?: unknown }).name)
          : '';
      if (
        /Mongo(ose)?(Network|ServerSelection|NotConnected|Timeout)/i.test(name)
      ) {
        throw new ServiceUnavailableException(
          ROOM_MESSAGES.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }
}
