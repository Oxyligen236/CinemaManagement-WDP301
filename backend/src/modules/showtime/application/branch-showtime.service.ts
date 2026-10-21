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
import { SeatType } from '../../room/domain/enums/seat-type.enum';
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
} from './dto/branch-showtime.dto';

type ManagerBranch = {
  branchId: string;
  branchName: string;
  address: string;
  branchStatus: BranchStatus;
};

type MovieSummary = {
  movieId: string;
  movieName: string;
  duration: number;
  status: MovieStatus;
  posterKey?: string;
  isActive: boolean;
};

type RoomSummary = {
  roomId: string;
  roomName: string;
  roomStatus: RoomStatus;
  branchId: string;
};

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

  /**
   * Lấy danh mục Phim đang hoạt động + Phòng chiếu thuộc chi nhánh của Manager
   */
  async getOptions(managerUserId?: string) {
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
          .lean<MovieSummary[]>()
          .exec(),
        this.roomModel
          .find({ branchId: branch.branchId })
          .select('roomId roomName roomStatus branchId')
          .sort({ roomName: 1 })
          .lean<RoomSummary[]>()
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

  /**
   * Main flow bước 1: Danh sách các suất chiếu tại chi nhánh của Manager
   */
  async listShowtimes(
    managerUserId: string | undefined,
    query: BranchShowtimeQueryDto,
  ) {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);

      const branchRooms = await this.roomModel
        .find({ branchId: branch.branchId })
        .select('roomId roomName roomStatus branchId')
        .lean<RoomSummary[]>()
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
        if (!Number.isNaN(startOfDay.getTime()) && !Number.isNaN(endOfDay.getTime())) {
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

  /**
   * Chi tiết 1 suất chiếu thuộc chi nhánh
   */
  async getShowtime(managerUserId: string | undefined, showtimeId: string) {
    return this.guard(async () => {
      const branch = await this.resolveManagerBranch(managerUserId);
      const branchRooms = await this.roomModel
        .find({ branchId: branch.branchId })
        .select('roomId roomName roomStatus branchId')
        .lean<RoomSummary[]>()
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

  /**
   * Main flow bước 3-6 (Tạo mới suất chiếu):
   * - Kiểm tra BR-BRM-04 (Phòng thuộc chi nhánh & AVAILABLE, Phim active)
   * - Tính endTime tự động theo BR-BRM-02 (startTime + movie.duration)
   * - Kiểm tra xung đột lịch chiếu theo BR-BRM-01
   * - Tạo Showtime + sinh SeatShowtime cho phòng chiếu
   */
  async createShowtime(
    managerUserId: string | undefined,
    input: CreateBranchShowtimeDto,
  ) {
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
          .lean<MovieSummary>()
          .exec(),
        this.roomModel
          .findOne({ roomId: input.roomId, branchId: branch.branchId })
          .select('roomId roomName roomStatus branchId')
          .lean<RoomSummary>()
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
        [created.toObject() as Showtime],
        [room],
      );

      return {
        message: SHOWTIME_MESSAGES.MSG02_CREATE,
        showtime: view,
      };
    });
  }

  /**
   * Main flow bước 3-6 (Cập nhật suất chiếu):
   * - Kiểm tra BR-BRM-03 / AF-3: Chặn cập nhật nếu suất chiếu đã có vé bán
   * - Kiểm tra BR-BRM-04 & tính lại endTime theo BR-BRM-02
   * - Kiểm tra trùng lịch phòng chiếu theo BR-BRM-01
   */
  async updateShowtime(
    managerUserId: string | undefined,
    showtimeId: string,
    input: UpdateBranchShowtimeDto,
  ) {
    return this.guard(async () => {
      if (Object.keys(input).length === 0) {
        throw new BadRequestException(SHOWTIME_MESSAGES.MSG01);
      }

      const branch = await this.resolveManagerBranch(managerUserId);
      const branchRooms = await this.roomModel
        .find({ branchId: branch.branchId })
        .select('roomId roomName roomStatus branchId')
        .lean<RoomSummary[]>()
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

      // Chặn chỉnh sửa nếu suất chiếu đã bắt đầu hoặc đã qua
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
          .lean<MovieSummary>()
          .exec(),
        this.roomModel
          .findOne({ roomId: targetRoomId, branchId: branch.branchId })
          .select('roomId roomName roomStatus branchId')
          .lean<RoomSummary>()
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

      // BR-BRM-01 / AF-2: Kiểm tra trùng lịch phòng chiếu (bỏ qua chính showtimeId này)
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

      // Nếu đổi phòng chiếu thì khởi tạo lại danh sách ghế theo phòng mới
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

  /**
   * Main flow bước 5-6 (Xóa suất chiếu):
   * - Kiểm tra BR-BRM-03 / AF-3: Chặn xóa nếu suất chiếu đã có vé bán
   */
  async deleteShowtime(managerUserId: string | undefined, showtimeId: string) {
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

      // Chặn xóa nếu suất chiếu đã bắt đầu hoặc đã qua
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

  // ---------------------------------------------------------------------------
  // Helper & Business Rule Validation Methods
  // ---------------------------------------------------------------------------

  /**
   * BR-BRM-01: Kiểm tra xem phòng chiếu đã có suất chiếu nào giao nhau với
   * khoảng [startTime, endTime) hay chưa.
   */
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

  /**
   * BR-BRM-03: Kiểm tra suất chiếu đã có ghế BOOKED hoặc RESERVED chưa
   */
  private async hasSoldOrReservedTickets(showtimeId: string): Promise<boolean> {
    const lockedExists = await this.seatShowtimeModel
      .exists({
        showtimeId,
        seatStatus: { $in: LOCKED_SEAT_SHOWTIME_STATUSES },
      })
      .exec();

    return Boolean(lockedExists);
  }

  /**
   * Tạo danh sách SeatShowtime (EMPTY) cho tất cả ghế AVAILABLE của phòng chiếu
   */
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

  /**
   * Ghép thông tin Phim, Phòng chiếu và Số lượng ghế đã bán vào danh sách Showtime
   */
  private async enrichShowtimes(
    showtimes: Showtime[],
    branchRooms: RoomSummary[],
  ) {
    if (showtimes.length === 0) return [];

    const movieIds = Array.from(new Set(showtimes.map((s) => s.movieId)));
    const showtimeIds = showtimes.map((s) => s.showtimeId);

    const [movies, seatStats] = await Promise.all([
      this.movieModel
        .find({ movieId: { $in: movieIds } })
        .select('movieId movieName duration status posterKey isActive')
        .lean<MovieSummary[]>()
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
      const totalSeats = stat?.totalSeats ?? 0;
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

  /**
   * Lấy thông tin chi nhánh của Branch Manager.
   * Nếu đang ở môi trường phát triển/demo mà chưa có user đăng nhập hoặc chưa gán chi nhánh,
   * tự động khởi tạo/lấy chi nhánh mặc định "Lotte Cinema Nam Sài Gòn" để có thể thao tác ngay.
   */
  private async resolveManagerBranch(
    managerUserId?: string,
  ): Promise<ManagerBranch> {
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
            .lean<ManagerBranch>()
            .exec();

          if (assignedBranch) {
            return assignedBranch;
          }
        }
      } else if (manager && manager.role !== Role.BRANCHMANAGER && manager.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập chức năng Quản lý Chi nhánh.',
        );
      }
    }

    // Fallback cho chi nhánh mặc định (hoặc tự tạo chi nhánh mẫu nếu DB mới tinh)
    let defaultBranch = await this.branchModel
      .findOne({ branchStatus: BranchStatus.ACTIVE })
      .select('branchId branchName address branchStatus')
      .lean<ManagerBranch>()
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

  /**
   * Đảm bảo Database có sẵn dữ liệu Phim đang chiếu và Phòng chiếu mẫu cho chi nhánh
   * khi chạy lần đầu tiên để Manager có thể lên lịch suất chiếu ngay.
   */
  private async ensureSampleMoviesAndRooms(branchId: string) {
    const [movieCount, roomCount] = await Promise.all([
      this.movieModel.countDocuments({ isActive: true }).exec(),
      this.roomModel.countDocuments({ branchId }).exec(),
    ]);

    if (movieCount === 0) {
      await this.movieModel.insertMany([
        {
          movieName: 'Lật Mặt 8: Vòng Tay Nắng',
          duration: 132,
          status: MovieStatus.NOW_SHOWING,
          isActive: true,
        },
        {
          movieName: 'Thám Tử Kiên: Kỳ Án Không Đầu',
          duration: 125,
          status: MovieStatus.NOW_SHOWING,
          isActive: true,
        },
        {
          movieName: 'Địa Đạo: Mặt Trời Trong Bóng Tối',
          duration: 128,
          status: MovieStatus.NOW_SHOWING,
          isActive: true,
        },
        {
          movieName: 'Doraemon: Nobita Và Cuộc Phiêu Lưu Vào Thế Giới Trong Tranh',
          duration: 105,
          status: MovieStatus.NOW_SHOWING,
          isActive: true,
        },
        {
          movieName: 'Nhiệm Vụ Bất Khả Thi: Nghiệp Báo Cuối Cùng',
          duration: 163,
          status: MovieStatus.COMING_SOON,
          isActive: true,
        },
      ]);
    }

    if (roomCount === 0) {
      await this.roomModel.insertMany([
        {
          roomName: 'Cinema 01 (2D Standard)',
          roomStatus: RoomStatus.AVAILABLE,
          branchId,
        },
        {
          roomName: 'Cinema 02 (3D Dolby Atmos)',
          roomStatus: RoomStatus.AVAILABLE,
          branchId,
        },
        {
          roomName: 'Cinema 03 (Super Plex)',
          roomStatus: RoomStatus.AVAILABLE,
          branchId,
        },
        {
          roomName: 'Cinema 04 (Charlotte VIP)',
          roomStatus: RoomStatus.MAINTENANCE,
          branchId,
        },
      ]);
    }

    // Đảm bảo mọi phòng chiếu thuộc chi nhánh đều có sơ đồ ghế (6 hàng A-F x 10 cột = 60 ghế)
    const branchRooms = await this.roomModel
      .find({ branchId })
      .select('roomId')
      .lean<{ roomId: string }[]>()
      .exec();

    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const room of branchRooms) {
      const seatCount = await this.seatModel
        .countDocuments({ roomId: room.roomId })
        .exec();
      if (seatCount === 0) {
        const seatDocs: {
          roomId: string;
          rowPosition: string;
          columnPosition: number;
          seatType: SeatType;
          status: SeatStatus;
        }[] = [];

        for (const row of rows) {
          for (let col = 1; col <= 10; col++) {
            seatDocs.push({
              roomId: room.roomId,
              rowPosition: row,
              columnPosition: col,
              seatType:
                row === 'D' || row === 'E'
                  ? SeatType.VIP
                  : row === 'F'
                    ? SeatType.COUPLE
                    : SeatType.STANDARD,
              status: SeatStatus.AVAILABLE,
            });
          }
        }
        await this.seatModel.insertMany(seatDocs, { ordered: false });
      }
    }

    // Đồng bộ SeatShowtime cho các suất chiếu cũ chưa có bản ghi ghế
    const branchRoomIds = branchRooms.map((r) => r.roomId);
    const existingShowtimes = await this.showtimeModel
      .find({ roomId: { $in: branchRoomIds } })
      .select('showtimeId roomId')
      .lean<{ showtimeId: string; roomId: string }[]>()
      .exec();

    for (const st of existingShowtimes) {
      const stSeatCount = await this.seatShowtimeModel
        .countDocuments({ showtimeId: st.showtimeId })
        .exec();
      if (stSeatCount === 0) {
        await this.initializeSeatShowtimes(st.showtimeId, st.roomId);
      }
    }
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
