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
import { Model, Types } from 'mongoose';
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

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : (id as unknown as Types.ObjectId);
}

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
        branchId: toObjectId(branch.branchId),
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
        .findOne({
          _id: toObjectId(roomId),
          branchId: toObjectId(branch.branchId),
        })
        .lean<Room>()
        .exec();

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const roomObjId = room._id;
      const roomIdStr = roomObjId.toString();

      // Nếu phòng chiếu chưa có bản ghi ghế nào, tự động khởi tạo lưới 6x10 mặc định
      const existingSeatCount = await this.seatModel
        .countDocuments({ roomId: roomObjId })
        .exec();
      if (existingSeatCount === 0) {
        await this.generateDefaultSeatsForRoom(roomObjId, 6, 10);
      }

      const [summaries, seatsWithLockInfo, upcomingShowtimes] =
        await Promise.all([
          this.buildRoomSummaries([room]),
          this.getRoomSeatsWithUpcomingBookingFlag(roomIdStr),
          this.getUpcomingShowtimesForRoom(roomIdStr),
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
          branchId: toObjectId(branch.branchId),
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
        branchId: toObjectId(branch.branchId),
      });

      const rows = input.rowCount ?? 6;
      const cols = input.columnsPerRow ?? 10;
      await this.generateDefaultSeatsForRoom(created._id, rows, cols);

      const [summary] = await this.buildRoomSummaries([created.toObject()]);

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
        .findOne({
          _id: toObjectId(roomId),
          branchId: toObjectId(branch.branchId),
        })
        .lean<Room>()
        .exec();

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const roomIdStr = room._id.toString();

      // BR-BRM-06 / AF-1: Nếu chuyển trạng thái phòng sang MAINTENANCE (hoặc CLOSED),
      // phải kiểm tra xem phòng có suất chiếu sắp tới hoặc đang diễn ra không.
      if (
        input.roomStatus &&
        input.roomStatus !== RoomStatus.AVAILABLE &&
        room.roomStatus === RoomStatus.AVAILABLE
      ) {
        const upcomingShowtimes =
          await this.getUpcomingShowtimesForRoom(roomIdStr);
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
            branchId: toObjectId(branch.branchId),
            _id: { $ne: toObjectId(roomId) },
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
          {
            _id: toObjectId(roomId),
            branchId: toObjectId(branch.branchId),
          },
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
        .findOne({
          _id: toObjectId(roomId),
          branchId: toObjectId(branch.branchId),
        })
        .lean<Room>()
        .exec();

      if (!room) {
        throw new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND);
      }

      const roomObjId = room._id;
      const targetSeatObjIds = input.seatIds.map((id) => toObjectId(id));

      const targetSeats = await this.seatModel
        .find({
          roomId: roomObjId,
          _id: { $in: targetSeatObjIds },
        })
        .lean<Seat[]>()
        .exec();

      if (targetSeats.length === 0) {
        throw new BadRequestException(ROOM_MESSAGES.SEAT_NOT_FOUND);
      }

      const validSeatObjIds = targetSeats.map((s) => s._id);

      // BR-BRM-07 / AF-2: Nếu chuyển sang trạng thái Hỏng (MAINTENANCE hoặc BLOCKED),
      // kiểm tra xem có ghế nào đã bán vé trong suất chiếu sắp tới không
      if (input.status && isSeatBrokenStatus(input.status)) {
        const upcomingShowtimes = await this.showtimeModel
          .find({
            roomId: roomObjId,
            endTime: { $gt: new Date() },
          })
          .select('_id')
          .lean<{ _id: Types.ObjectId }[]>()
          .exec();

        const upcomingShowtimeObjIds = upcomingShowtimes.map((s) => s._id);

        if (upcomingShowtimeObjIds.length > 0) {
          const soldSeatShowtimes = await this.seatShowtimeModel
            .find({
              showtimeId: { $in: upcomingShowtimeObjIds },
              seatId: { $in: validSeatObjIds },
              seatStatus: { $in: LOCKED_UPCOMING_SEAT_STATUSES },
            })
            .select('seatId showtimeId')
            .lean<{ seatId: Types.ObjectId; showtimeId: Types.ObjectId }[]>()
            .exec();

          if (soldSeatShowtimes.length > 0) {
            const lockedSeatIdSet = new Set(
              soldSeatShowtimes.map((s) => s.seatId.toString()),
            );
            const lockedLabels = targetSeats
              .filter((s) => lockedSeatIdSet.has(s._id.toString()))
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
              showtimeId: { $in: upcomingShowtimeObjIds },
              seatId: { $in: validSeatObjIds },
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
          { roomId: roomObjId, _id: { $in: validSeatObjIds } },
          { $set: setFields },
        )
        .exec();

      // AF-3: Nếu khôi phục ghế về AVAILABLE, đảm bảo các suất chiếu tương lai có lại bản ghi SeatShowtime (EMPTY)
      if (input.status === SeatStatus.AVAILABLE) {
        const upcomingShowtimes = await this.showtimeModel
          .find({
            roomId: roomObjId,
            endTime: { $gt: new Date() },
          })
          .select('_id')
          .lean<{ _id: Types.ObjectId }[]>()
          .exec();

        for (const st of upcomingShowtimes) {
          const existingEntries = await this.seatShowtimeModel
            .find({
              showtimeId: st._id,
              seatId: { $in: validSeatObjIds },
            })
            .select('seatId')
            .lean<{ seatId: Types.ObjectId }[]>()
            .exec();

          const existingSet = new Set(
            existingEntries.map((e) => e.seatId.toString()),
          );
          const missingSeatObjIds = validSeatObjIds.filter(
            (id) => !existingSet.has(id.toString()),
          );

          if (missingSeatObjIds.length > 0) {
            await this.seatShowtimeModel.insertMany(
              missingSeatObjIds.map((seatId) => ({
                showtimeId: st._id,
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
        this.getRoomSeatsWithUpcomingBookingFlag(roomObjId.toString()),
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
    const roomObjIds = rooms.map((r) => r._id);
    const now = new Date();

    const [seatStats, showtimeCounts] = await Promise.all([
      this.seatModel.aggregate<{
        _id: Types.ObjectId;
        totalSeats: number;
        availableSeats: number;
        brokenSeats: number;
        standardSeats: number;
        vipSeats: number;
        coupleSeats: number;
      }>([
        { $match: { roomId: { $in: roomObjIds } } },
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
        _id: Types.ObjectId;
        upcomingCount: number;
      }>([
        {
          $match: {
            roomId: { $in: roomObjIds },
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

    const seatMap = new Map(seatStats.map((s) => [s._id.toString(), s]));
    const showtimeMap = new Map(
      showtimeCounts.map((s) => [s._id.toString(), s.upcomingCount]),
    );

    return rooms.map((room) => {
      const roomIdStr = room._id.toString();
      const stat = seatMap.get(roomIdStr);
      return BranchRoomSummaryDto.from({
        roomId: roomIdStr,
        roomName: room.roomName,
        roomStatus: room.roomStatus,
        branchId: room.branchId.toString(),
        totalSeats: stat?.totalSeats ?? 0,
        availableSeats: stat?.availableSeats ?? 0,
        brokenSeats: stat?.brokenSeats ?? 0,
        standardSeats: stat?.standardSeats ?? 0,
        vipSeats: stat?.vipSeats ?? 0,
        coupleSeats: stat?.coupleSeats ?? 0,
        upcomingShowtimesCount: showtimeMap.get(roomIdStr) ?? 0,
      });
    });
  }

  private async getRoomSeatsWithUpcomingBookingFlag(
    roomId: string,
  ): Promise<RoomSeatItemDto[]> {
    const roomObjId = toObjectId(roomId);
    const [seats, upcomingShowtimes] = await Promise.all([
      this.seatModel
        .find({ roomId: roomObjId })
        .sort({ rowPosition: 1, columnPosition: 1 })
        .lean<Seat[]>()
        .exec(),
      this.showtimeModel
        .find({ roomId: roomObjId, endTime: { $gt: new Date() } })
        .select('_id')
        .lean<{ _id: Types.ObjectId }[]>()
        .exec(),
    ]);

    const bookedSeatIds = new Set<string>();
    if (upcomingShowtimes.length > 0) {
      const lockedEntries = await this.seatShowtimeModel
        .find({
          showtimeId: { $in: upcomingShowtimes.map((s) => s._id) },
          seatStatus: { $in: LOCKED_UPCOMING_SEAT_STATUSES },
        })
        .select('seatId')
        .lean<{ seatId: Types.ObjectId }[]>()
        .exec();

      for (const entry of lockedEntries) {
        bookedSeatIds.add(entry.seatId.toString());
      }
    }

    return seats.map((seat) =>
      RoomSeatItemDto.from({
        seatId: seat._id.toString(),
        roomId: seat.roomId.toString(),
        rowPosition: seat.rowPosition,
        columnPosition: seat.columnPosition,
        seatLabel: `${seat.rowPosition}${seat.columnPosition}`,
        seatType: seat.seatType,
        status: seat.status,
        isBroken: isSeatBrokenStatus(seat.status),
        hasUpcomingBookedTicket: bookedSeatIds.has(seat._id.toString()),
      }),
    );
  }

  private async getUpcomingShowtimesForRoom(
    roomId: string,
  ): Promise<RoomUpcomingShowtimeDto[]> {
    const roomObjId = toObjectId(roomId);
    const showtimes = await this.showtimeModel
      .find({
        roomId: roomObjId,
        endTime: { $gt: new Date() },
      })
      .sort({ startTime: 1 })
      .lean<Showtime[]>()
      .exec();

    if (showtimes.length === 0) return [];

    const movieObjIds = Array.from(new Set(showtimes.map((s) => s.movieId)));
    const movies = await this.movieModel
      .find({ _id: { $in: movieObjIds } })
      .select('_id movieName')
      .lean<{ _id: Types.ObjectId; movieName: string }[]>()
      .exec();

    const movieNameMap = new Map(
      movies.map((m) => [m._id.toString(), m.movieName]),
    );

    return showtimes.map((st) => ({
      showtimeId: st._id.toString(),
      movieId: st.movieId.toString(),
      movieName:
        movieNameMap.get(st.movieId.toString()) ?? 'Phim đang xếp lịch',
      startTime: st.startTime,
      endTime: st.endTime,
    }));
  }

  private async generateDefaultSeatsForRoom(
    roomId: string | Types.ObjectId,
    rowCount: number,
    columnsPerRow: number,
  ) {
    const roomObjId = toObjectId(roomId);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const seatDocs: {
      roomId: Types.ObjectId;
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
          roomId: roomObjId,
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
      const managerUserObjId = toObjectId(managerUserId);
      const manager = await this.userModel
        .findOne({ _id: managerUserObjId })
        .select('_id role isActive branchId')
        .lean()
        .exec();

      const isManagerRole = manager?.role === Role.BRANCHMANAGER;
      if (manager && (!manager.isActive || !isManagerRole)) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập chức năng Quản lý Chi nhánh.',
        );
      }
      if (manager && manager.isActive && isManagerRole) {
        if (manager.branchId) {
          const assignedBranch = await this.branchModel
            .findById(manager.branchId)
            .select('_id branchName address branchStatus')
            .lean()
            .exec();

          if (assignedBranch) {
            return RoomManagerBranchDto.from({
              branchId: assignedBranch._id.toString(),
              branchName: assignedBranch.branchName,
              address: assignedBranch.address,
              branchStatus: assignedBranch.branchStatus,
            });
          }
        }
      }
    }

    let defaultBranch = await this.branchModel
      .findOne({ branchStatus: BranchStatus.ACTIVE })
      .select('_id branchName address branchStatus')
      .lean()
      .exec();

    if (!defaultBranch) {
      const created = await this.branchModel.create({
        branchName: 'Lotte Cinema Nam Sài Gòn',
        address:
          'Tầng 3, TTTM Lotte, số 469 đường Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7, TP.HCM',
        branchStatus: BranchStatus.ACTIVE,
      });
      defaultBranch = {
        _id: created._id,
        branchName: created.branchName,
        address: created.address,
        branchStatus: created.branchStatus,
      } as NonNullable<typeof defaultBranch>;
    }

    const branch = defaultBranch;
    return RoomManagerBranchDto.from({
      branchId: branch._id.toString(),
      branchName: branch.branchName,
      address: branch.address,
      branchStatus: branch.branchStatus,
    });
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
