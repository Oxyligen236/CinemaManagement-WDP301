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
import { Room, RoomDocument } from '../../room/domain/schemas/room.schema';
import { RoomStatus } from '../../room/domain/enums/room-status.enum';
import { Seat, SeatDocument } from '../../room/domain/schemas/seat.schema';
import { SeatStatus } from '../../room/domain/enums/seat-status.enum';
import { Movie, MovieDocument } from '../../movie/domain/schemas/movie.schema';
import { MovieStatus } from '../../movie/domain/enums/movie-status.enum';
import {
  Showtime,
  ShowtimeDocument,
} from '../domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../domain/schemas/seat-showtime.schema';
import { SeatShowtimeStatus } from '../domain/enums/seat-showtime-status.enum';
import {
  LOCKED_SEAT_SHOWTIME_STATUSES,
  SHOWTIME_MESSAGES,
  calculateShowtimeEndTime,
  isRoomAssignable,
} from '../domain/showtime.rules';
import {
  BranchShowtimeQueryDto,
  CreateBranchShowtimeDto,
  UpdateBranchShowtimeDto,
} from './dto/req.dto';
import {
  BranchShowtimeDeleteResponseDto,
  BranchShowtimeDetailResponseDto,
  BranchShowtimeItemDto,
  BranchShowtimeListResponseDto,
  BranchShowtimeMutationResponseDto,
  ManagerBranchDto,
  ShowtimeMovieOptionDto,
  ShowtimeOptionsResponseDto,
  ShowtimeRoomOptionDto,
} from './dto/res.dto';

@Injectable()
export class BranchShowtimeService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Seat.name)
    private readonly seatModel: Model<SeatDocument>,
    @InjectModel(Movie.name)
    private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
  ) {}

  async getOptions(managerUserId?: string): Promise<ShowtimeOptionsResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);

      const [movies, rooms] = await Promise.all([
        this.movieModel
          .find({
            isActive: true,
            status: { $in: [MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON] },
          })
          .select('movieId movieName duration status posterKey isActive')
          .sort({ movieName: 1 })
          .lean<ShowtimeMovieOptionDto[]>()
          .exec(),
        this.roomModel
          .find({ branchId: branch.branchId })
          .select('roomId roomName roomStatus branchId')
          .sort({ roomName: 1 })
          .lean<ShowtimeRoomOptionDto[]>()
          .exec(),
      ]);

      const seatCounts = await this.seatModel.aggregate<{
        _id: string;
        totalSeats: number;
        availableSeats: number;
      }>([
        {
          $match: {
            roomId: { $in: rooms.map((r) => r.roomId) },
          },
        },
        {
          $group: {
            _id: '$roomId',
            totalSeats: { $sum: 1 },
            availableSeats: {
              $sum: {
                $cond: [{ $eq: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
              },
            },
          },
        },
      ]);

      const seatCountMap = new Map(
        seatCounts.map((item) => [item._id, item]),
      );

      return {
        branch,
        movies,
        rooms: rooms.map((room) => ({
          ...room,
          totalSeats: seatCountMap.get(room.roomId)?.totalSeats ?? 60,
          availableSeats: seatCountMap.get(room.roomId)?.availableSeats ?? 60,
        })),
      };
    });
  }

  async listShowtimes(
    managerUserId: string | undefined,
    query: BranchShowtimeQueryDto,
  ): Promise<BranchShowtimeListResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);

      const branchRooms = await this.roomModel
        .find({ branchId: branch.branchId })
        .select('roomId roomName roomStatus branchId')
        .lean<ShowtimeRoomOptionDto[]>()
        .exec();

      const branchRoomIds = branchRooms.map((r) => r.roomId);
      if (branchRoomIds.length === 0) {
        return {
          branch,
          showtimes: [],
          total: 0,
        };
      }

      const filter: Record<string, unknown> = {
        roomId: query.roomId
          ? branchRoomIds.includes(query.roomId)
            ? query.roomId
            : '__none__'
          : { $in: branchRoomIds },
      };

      if (query.movieId) {
        filter.movieId = query.movieId;
      }

      if (query.date) {
        const startOfDay = new Date(`${query.date}T00:00:00.000+07:00`);
        const endOfDay = new Date(`${query.date}T23:59:59.999+07:00`);
        if (
          !Number.isNaN(startOfDay.getTime()) &&
          !Number.isNaN(endOfDay.getTime())
        ) {
          filter.startTime = { $gte: startOfDay, $lte: endOfDay };
        }
      }

      const showtimes = await this.showtimeModel
        .find(filter)
        .sort({ startTime: -1 })
        .lean<Showtime[]>()
        .exec();

      const enriched = await this.enrichShowtimes(showtimes, branchRooms);

      const filtered = query.search
        ? enriched.filter((item) => {
            const q = query.search!.toLowerCase();
            return (
              item.movieName.toLowerCase().includes(q) ||
              item.roomName.toLowerCase().includes(q)
            );
          })
        : enriched;

      return {
        branch,
        showtimes: filtered,
        total: filtered.length,
      };
    });
  }

  async getShowtime(
    managerUserId: string | undefined,
    showtimeId: string,
  ): Promise<BranchShowtimeDetailResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);
      const branchRooms = await this.roomModel
        .find({ branchId: branch.branchId })
        .select('roomId roomName roomStatus branchId')
        .lean<ShowtimeRoomOptionDto[]>()
        .exec();

      const showtime = await this.showtimeModel
        .findOne({
          showtimeId,
          roomId: { $in: branchRooms.map((r) => r.roomId) },
        })
        .lean<Showtime>()
        .exec();

      if (!showtime) {
        throw new NotFoundException(SHOWTIME_MESSAGES.SHOWTIME_NOT_FOUND);
      }

      const [view] = await this.enrichShowtimes([showtime], branchRooms);
      return { branch, showtime: view };
    });
  }

  async createShowtime(
    managerUserId: string | undefined,
    input: CreateBranchShowtimeDto,
  ): Promise<BranchShowtimeMutationResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);
      if (branch.branchStatus !== BranchStatus.ACTIVE) {
        throw new BadRequestException(SHOWTIME_MESSAGES.BRANCH_NOT_ACTIVE);
      }

      const [movie, room] = await Promise.all([
        this.movieModel
          .findOne({
            movieId: input.movieId,
            isActive: true,
            status: { $in: [MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON] },
          })
          .select('movieId movieName duration status isActive')
          .lean<ShowtimeMovieOptionDto>()
          .exec(),
        this.roomModel
          .findOne({ roomId: input.roomId, branchId: branch.branchId })
          .select('roomId roomName roomStatus branchId')
          .lean<ShowtimeRoomOptionDto>()
          .exec(),
      ]);

      if (!movie) {
        throw new BadRequestException(SHOWTIME_MESSAGES.MOVIE_NOT_FOUND);
      }
      if (!room) {
        throw new BadRequestException(SHOWTIME_MESSAGES.ROOM_NOT_FOUND);
      }
      if (!isRoomAssignable(room.roomStatus)) {
        throw new BadRequestException(SHOWTIME_MESSAGES.ROOM_NOT_AVAILABLE);
      }

      const startTime = new Date(input.startTime);
      if (Number.isNaN(startTime.getTime())) {
        throw new BadRequestException(SHOWTIME_MESSAGES.MSG01);
      }
      if (startTime.getTime() <= Date.now()) {
        throw new BadRequestException(SHOWTIME_MESSAGES.PAST_START_TIME);
      }

      // BR-BRM-02: Tính thời gian kết thúc dựa trên thời lượng phim
      const endTime = calculateShowtimeEndTime(startTime, movie.duration);

      // BR-BRM-01 / AF-2: Kiểm tra trùng lịch trong cùng phòng chiếu
      await this.assertNoRoomConflict(room.roomId, startTime, endTime);

      const created = await this.showtimeModel.create({
        movieId: movie.movieId,
        roomId: room.roomId,
        startTime,
        endTime,
        basePrice: input.basePrice ?? 75000,
      });

      await this.initializeSeatShowtimes(created.showtimeId, room.roomId);

      const [view] = await this.enrichShowtimes(
        [created.toObject()],
        [room],
      );

      return {
        message: SHOWTIME_MESSAGES.MSG02_CREATE,
        showtime: view,
      };
    });
  }

  async updateShowtime(
    managerUserId: string | undefined,
    showtimeId: string,
    input: UpdateBranchShowtimeDto,
  ): Promise<BranchShowtimeMutationResponseDto> {
    return this.guard(async () => {
      if (Object.keys(input).length === 0) {
        throw new BadRequestException(SHOWTIME_MESSAGES.MSG01);
      }

      const branch = await this.resolveManagerBranch(managerUserId);
      const branchRooms = await this.roomModel
        .find({ branchId: branch.branchId })
        .select('roomId roomName roomStatus branchId')
        .lean<ShowtimeRoomOptionDto[]>()
        .exec();

      const existing = await this.showtimeModel
        .findOne({
          showtimeId,
          roomId: { $in: branchRooms.map((r) => r.roomId) },
        })
        .lean<Showtime>()
        .exec();

      if (!existing) {
        throw new NotFoundException(SHOWTIME_MESSAGES.SHOWTIME_NOT_FOUND);
      }

      if (new Date(existing.startTime).getTime() <= Date.now()) {
        throw new ConflictException(
          SHOWTIME_MESSAGES.PAST_SHOWTIME_UPDATE_LOCKED,
        );
      }

      // BR-BRM-03 / AF-3: Không cho sửa suất chiếu đã bán vé / đặt chỗ
      const hasSold = await this.hasSoldOrReservedTickets(showtimeId);
      if (hasSold) {
        throw new ConflictException(SHOWTIME_MESSAGES.MSG04_UPDATE_LOCKED);
      }

      const targetMovieId = input.movieId ?? existing.movieId;
      const targetRoomId = input.roomId ?? existing.roomId;
      const targetStartTime = input.startTime
        ? new Date(input.startTime)
        : new Date(existing.startTime);

      if (Number.isNaN(targetStartTime.getTime())) {
        throw new BadRequestException(SHOWTIME_MESSAGES.MSG01);
      }
      if (targetStartTime.getTime() <= Date.now()) {
        throw new BadRequestException(SHOWTIME_MESSAGES.PAST_START_TIME);
      }

      const [movie, room] = await Promise.all([
        this.movieModel
          .findOne({
            movieId: targetMovieId,
            isActive: true,
            status: { $in: [MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON] },
          })
          .select('movieId movieName duration status isActive')
          .lean<ShowtimeMovieOptionDto>()
          .exec(),
        this.roomModel
          .findOne({ roomId: targetRoomId, branchId: branch.branchId })
          .select('roomId roomName roomStatus branchId')
          .lean<ShowtimeRoomOptionDto>()
          .exec(),
      ]);

      if (!movie) {
        throw new BadRequestException(SHOWTIME_MESSAGES.MOVIE_NOT_FOUND);
      }
      if (!room) {
        throw new BadRequestException(SHOWTIME_MESSAGES.ROOM_NOT_FOUND);
      }
      if (!isRoomAssignable(room.roomStatus)) {
        throw new BadRequestException(SHOWTIME_MESSAGES.ROOM_NOT_AVAILABLE);
      }

      // BR-BRM-02: Tính lại endTime dựa trên thời lượng phim
      const targetEndTime = calculateShowtimeEndTime(
        targetStartTime,
        movie.duration,
      );

      // BR-BRM-01 / AF-2: Kiểm tra trùng lịch phòng chiếu
      await this.assertNoRoomConflict(
        room.roomId,
        targetStartTime,
        targetEndTime,
        showtimeId,
      );

      const updated = await this.showtimeModel
        .findOneAndUpdate(
          { showtimeId },
          {
            $set: {
              movieId: movie.movieId,
              roomId: room.roomId,
              startTime: targetStartTime,
              endTime: targetEndTime,
              ...(input.basePrice !== undefined
                ? { basePrice: input.basePrice }
                : {}),
            },
          },
          { new: true, runValidators: true },
        )
        .lean<Showtime>()
        .exec();

      if (!updated) {
        throw new NotFoundException(SHOWTIME_MESSAGES.SHOWTIME_NOT_FOUND);
      }

      if (room.roomId !== existing.roomId) {
        await this.seatShowtimeModel.deleteMany({ showtimeId }).exec();
        await this.initializeSeatShowtimes(showtimeId, room.roomId);
      }

      const [view] = await this.enrichShowtimes([updated], branchRooms);

      return {
        message: SHOWTIME_MESSAGES.MSG02_UPDATE,
        showtime: view,
      };
    });
  }

  async deleteShowtime(
    managerUserId: string | undefined,
    showtimeId: string,
  ): Promise<BranchShowtimeDeleteResponseDto> {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);
      const branchRooms = await this.roomModel
        .find({ branchId: branch.branchId })
        .select('roomId')
        .lean<{ roomId: string }[]>()
        .exec();

      const existing = await this.showtimeModel
        .findOne({
          showtimeId,
          roomId: { $in: branchRooms.map((r) => r.roomId) },
        })
        .lean<Showtime>()
        .exec();

      if (!existing) {
        throw new NotFoundException(SHOWTIME_MESSAGES.SHOWTIME_NOT_FOUND);
      }

      if (new Date(existing.startTime).getTime() <= Date.now()) {
        throw new ConflictException(
          SHOWTIME_MESSAGES.PAST_SHOWTIME_DELETE_LOCKED,
        );
      }

      // BR-BRM-03 / AF-3: Không cho xóa suất chiếu đã bán vé / đặt chỗ
      const hasSold = await this.hasSoldOrReservedTickets(showtimeId);
      if (hasSold) {
        throw new ConflictException(SHOWTIME_MESSAGES.MSG05_DELETE_LOCKED);
      }

      await Promise.all([
        this.seatShowtimeModel.deleteMany({ showtimeId }).exec(),
        this.showtimeModel.deleteOne({ showtimeId }).exec(),
      ]);

      return {
        message: SHOWTIME_MESSAGES.MSG02_DELETE,
        showtimeId,
      };
    });
  }

  private async assertNoRoomConflict(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeShowtimeId?: string,
  ) {
    const conflictFilter: Record<string, unknown> = {
      roomId,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };

    if (excludeShowtimeId) {
      conflictFilter.showtimeId = { $ne: excludeShowtimeId };
    }

    const conflicting = await this.showtimeModel
      .findOne(conflictFilter)
      .select('showtimeId movieId startTime endTime')
      .lean<Showtime>()
      .exec();

    if (conflicting) {
      const conflictMovie = await this.movieModel
        .findOne({ movieId: conflicting.movieId })
        .select('movieName')
        .lean<{ movieName: string }>()
        .exec();

      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: SHOWTIME_MESSAGES.MSG03_CONFLICT,
        conflict: {
          showtimeId: conflicting.showtimeId,
          movieName: conflictMovie?.movieName ?? 'Suất chiếu khác',
          startTime: conflicting.startTime,
          endTime: conflicting.endTime,
        },
      });
    }
  }

  private async hasSoldOrReservedTickets(showtimeId: string): Promise<boolean> {
    const lockedExists = await this.seatShowtimeModel
      .exists({
        showtimeId,
        seatStatus: { $in: LOCKED_SEAT_SHOWTIME_STATUSES },
      })
      .exec();

    return Boolean(lockedExists);
  }

  private async initializeSeatShowtimes(showtimeId: string, roomId: string) {
    const seats = await this.seatModel
      .find({ roomId, status: SeatStatus.AVAILABLE })
      .select('seatId')
      .lean<{ seatId: string }[]>()
      .exec();

    if (seats.length === 0) return;

    await this.seatShowtimeModel.insertMany(
      seats.map((seat) => ({
        showtimeId,
        seatId: seat.seatId,
        seatStatus: SeatShowtimeStatus.EMPTY,
      })),
      { ordered: false },
    );
  }

  private async enrichShowtimes(
    showtimes: Showtime[],
    branchRooms: ShowtimeRoomOptionDto[],
  ): Promise<BranchShowtimeItemDto[]> {
    if (showtimes.length === 0) return [];

    const movieIds = Array.from(new Set(showtimes.map((s) => s.movieId)));
    const showtimeIds = showtimes.map((s) => s.showtimeId);

    const [movies, seatStats] = await Promise.all([
      this.movieModel
        .find({ movieId: { $in: movieIds } })
        .select('movieId movieName duration status posterKey isActive')
        .lean<ShowtimeMovieOptionDto[]>()
        .exec(),
      this.seatShowtimeModel.aggregate<{
        _id: string;
        totalSeats: number;
        bookedSeats: number;
        reservedSeats: number;
      }>([
        {
          $match: {
            showtimeId: { $in: showtimeIds },
          },
        },
        {
          $group: {
            _id: '$showtimeId',
            totalSeats: { $sum: 1 },
            bookedSeats: {
              $sum: {
                $cond: [
                  { $eq: ['$seatStatus', SeatShowtimeStatus.BOOKED] },
                  1,
                  0,
                ],
              },
            },
            reservedSeats: {
              $sum: {
                $cond: [
                  { $eq: ['$seatStatus', SeatShowtimeStatus.RESERVED] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const movieMap = new Map(movies.map((m) => [m.movieId, m]));
    const roomMap = new Map(branchRooms.map((r) => [r.roomId, r]));
    const seatStatMap = new Map(seatStats.map((stat) => [stat._id, stat]));

    return showtimes.map((showtime) => {
      const movie = movieMap.get(showtime.movieId);
      const room = roomMap.get(showtime.roomId);
      const stat = seatStatMap.get(showtime.showtimeId);
      const totalSeats = stat?.totalSeats ?? 60;
      const bookedSeats = stat?.bookedSeats ?? 0;
      const reservedSeats = stat?.reservedSeats ?? 0;
      const soldOrReserved = bookedSeats + reservedSeats;
      const nowMs = Date.now();
      const startMs = new Date(showtime.startTime).getTime();
      const endMs = new Date(showtime.endTime).getTime();
      const isPast = endMs <= nowMs;
      const isOngoing = startMs <= nowMs && endMs > nowMs;

      return {
        showtimeId: showtime.showtimeId,
        movieId: showtime.movieId,
        movieName: movie?.movieName ?? 'Phim không xác định',
        duration: movie?.duration ?? 0,
        movieStatus: movie?.status ?? MovieStatus.NOW_SHOWING,
        posterKey: movie?.posterKey ?? null,
        roomId: showtime.roomId,
        roomName: room?.roomName ?? 'Phòng không xác định',
        roomStatus: room?.roomStatus ?? RoomStatus.AVAILABLE,
        startTime: showtime.startTime,
        endTime: showtime.endTime,
        basePrice: showtime.basePrice,
        totalSeats,
        bookedSeats,
        reservedSeats,
        availableSeats: Math.max(0, totalSeats - soldOrReserved),
        hasSoldTickets: soldOrReserved > 0,
        isPast,
        isOngoing,
      };
    });
  }

  private async resolveManagerBranch(
    managerUserId?: string,
  ): Promise<ManagerBranchDto> {
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
            .lean<ManagerBranchDto>()
            .exec();

          if (assignedBranch) {
            return assignedBranch;
          }
        }
      }
    }

    let defaultBranch = await this.branchModel
      .findOne({ branchStatus: BranchStatus.ACTIVE })
      .select('branchId branchName address branchStatus')
      .lean<ManagerBranchDto>()
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
          SHOWTIME_MESSAGES.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }
}
