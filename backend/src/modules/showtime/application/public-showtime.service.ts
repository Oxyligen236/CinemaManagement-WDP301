/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  DayPriceRule,
  DayPriceRuleDocument,
} from '../../pricerule/domain/schemas/day-price-rule.schema';
import {
  SeatPriceRule,
  SeatPriceRuleDocument,
} from '../../pricerule/domain/schemas/seat-price-rule.schema';
import { DayType } from '../../pricerule/domain/enums/day-type.enum';
import {
  Showtime,
  ShowtimeDocument,
} from '../domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../domain/schemas/seat-showtime.schema';
import { SeatShowtimeStatus } from '../domain/enums/seat-showtime-status.enum';
import { SHOWTIME_MESSAGES } from '../domain/showtime.rules';
import { PublicShowtimeQueryDto } from './dto/req.dto';
import {
  ManagerBranchDto,
  PublicShowtimeItemDto,
  PublicShowtimeListResponseDto,
  PublicShowtimeSeatDto,
  PublicShowtimeSeatsResponseDto,
  ShowtimeMovieOptionDto,
} from './dto/res.dto';

const DEFAULT_SEAT_SURCHARGES: Record<SeatType, number> = {
  [SeatType.STANDARD]: 0,
  [SeatType.VIP]: 0,
  [SeatType.COUPLE]: 0,
};

@Injectable()
export class PublicShowtimeService {
  constructor(
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
    @InjectModel(DayPriceRule.name)
    private readonly dayPriceRuleModel: Model<DayPriceRuleDocument>,
    @InjectModel(SeatPriceRule.name)
    private readonly seatPriceRuleModel: Model<SeatPriceRuleDocument>,
  ) {}

  async listShowtimes(
    query: PublicShowtimeQueryDto,
  ): Promise<PublicShowtimeListResponseDto> {
    return this.guard(async () => {
      const [branches, movies] = await Promise.all([
        this.branchModel
          .find({ branchStatus: BranchStatus.ACTIVE })
          .select('branchId branchName address branchStatus')
          .sort({ branchName: 1 })
          .lean<ManagerBranchDto[]>()
          .exec(),
        this.movieModel
          .find({
            isActive: true,
            status: { $in: [MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON] },
          })
          .select('movieId movieName duration status posterKey isActive')
          .sort({ movieName: 1 })
          .lean<ShowtimeMovieOptionDto[]>()
          .exec(),
      ]);

      const activeBranchIds = branches.map((b) => b.branchId);
      const targetBranchIds = query.branchId
        ? activeBranchIds.filter((id) => id === query.branchId)
        : activeBranchIds;

      if (targetBranchIds.length === 0) {
        return {
          branches,
          movies,
          showtimes: [],
          total: 0,
        };
      }

      const roomFilter: Record<string, unknown> = {
        branchId: { $in: targetBranchIds },
        roomStatus: RoomStatus.AVAILABLE,
      };
      if (query.roomId) {
        roomFilter.roomId = query.roomId;
      }

      const rooms = await this.roomModel
        .find(roomFilter)
        .select('roomId roomName roomStatus branchId')
        .lean<
          {
            roomId: string;
            roomName: string;
            roomStatus: RoomStatus;
            branchId: string;
          }[]
        >()
        .exec();

      if (rooms.length === 0) {
        return {
          branches,
          movies,
          showtimes: [],
          total: 0,
        };
      }

      const showtimeFilter: Record<string, unknown> = {
        roomId: { $in: rooms.map((r) => r.roomId) },
      };

      if (query.movieId) {
        showtimeFilter.movieId = query.movieId;
      } else {
        showtimeFilter.movieId = { $in: movies.map((m) => m.movieId) };
      }

      if (query.date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            message: SHOWTIME_MESSAGES.MSG01,
            fields: ['date'],
          });
        }
        const dayStart = new Date(`${query.date}T00:00:00.000+07:00`);
        const dayEnd = new Date(`${query.date}T23:59:59.999+07:00`);
        showtimeFilter.startTime = { $gte: dayStart, $lte: dayEnd };
      }

      if (!query.includePast) {
        showtimeFilter.endTime = { $gt: new Date() };
      }

      const showtimes = await this.showtimeModel
        .find(showtimeFilter)
        .sort({ startTime: 1 })
        .lean<Showtime[]>()
        .exec();

      const items = await this.enrichPublicShowtimes(
        showtimes,
        rooms,
        branches,
        movies,
      );

      return {
        branches,
        movies,
        showtimes: items,
        total: items.length,
      };
    });
  }

  async getShowtimeSeats(
    showtimeId: string,
  ): Promise<PublicShowtimeSeatsResponseDto> {
    return this.guard(async () => {
      const showtime = await this.showtimeModel
        .findOne({ showtimeId })
        .lean<Showtime>()
        .exec();

      if (!showtime) {
        throw new NotFoundException(SHOWTIME_MESSAGES.SHOWTIME_NOT_FOUND);
      }

      const room = await this.roomModel
        .findOne({ roomId: showtime.roomId })
        .select('roomId roomName roomStatus branchId')
        .lean<{
          roomId: string;
          roomName: string;
          roomStatus: RoomStatus;
          branchId: string;
        }>()
        .exec();

      if (!room) {
        throw new NotFoundException('Không tìm thấy phòng chiếu của suất chiếu.');
      }

      const [branch, movie, seats, seatShowtimes, dayRules, seatRules] =
        await Promise.all([
          this.branchModel
            .findOne({ branchId: room.branchId })
            .select('branchId branchName address branchStatus')
            .lean<ManagerBranchDto>()
            .exec(),
          this.movieModel
            .findOne({ movieId: showtime.movieId })
            .select('movieId movieName duration status posterKey isActive')
            .lean<ShowtimeMovieOptionDto>()
            .exec(),
          this.seatModel
            .find({ roomId: room.roomId })
            .sort({ rowPosition: 1, columnPosition: 1 })
            .lean<Seat[]>()
            .exec(),
          this.seatShowtimeModel
            .find({ showtimeId })
            .lean<SeatShowtime[]>()
            .exec(),
          this.dayPriceRuleModel.find().lean<DayPriceRule[]>().exec(),
          this.seatPriceRuleModel.find().lean<SeatPriceRule[]>().exec(),
        ]);

      // Tính phụ thu ngày chiếu (Thứ 7 / Chủ Nhật = WEEKEND, ngày thường = WEEKDAY)
      const startDayOfWeek = new Date(showtime.startTime).getDay();
      const targetDayType =
        startDayOfWeek === 0 || startDayOfWeek === 6
          ? DayType.WEEKEND
          : DayType.WEEKDAY;

      const matchedDayRule = showtime.dayPriceRuleId
        ? dayRules.find((r) => r.ruleId === showtime.dayPriceRuleId)
        : dayRules.find((r) => r.dayType === targetDayType);
      const dayAdjustment = matchedDayRule?.adjustmentValue ?? 0;

      // Tính phụ thu từng loại ghế (ưu tiên cấu hình DB, fallback mặc định)
      const seatAdjustments: Record<SeatType, number> = {
        ...DEFAULT_SEAT_SURCHARGES,
      };
      for (const rule of seatRules) {
        if (rule.seatType in seatAdjustments) {
          seatAdjustments[rule.seatType as SeatType] = rule.adjustmentValue;
        }
      }

      const seatShowtimeMap = new Map(
        seatShowtimes.map((ss) => [ss.seatId, ss]),
      );

      const mappedSeats: PublicShowtimeSeatDto[] = seats
        .sort((a, b) => {
          const rowCmp = a.rowPosition.localeCompare(b.rowPosition);
          if (rowCmp !== 0) return rowCmp;
          return a.columnPosition - b.columnPosition;
        })
        .map((seat) => {
          const ss = seatShowtimeMap.get(seat.seatId);
          const bookingStatus = ss?.seatStatus ?? SeatShowtimeStatus.EMPTY;
          const isSelectable =
            seat.status === SeatStatus.AVAILABLE &&
            bookingStatus === SeatShowtimeStatus.EMPTY;
          const seatSurcharge = seatAdjustments[seat.seatType] ?? 0;
          const price = Math.max(
            0,
            showtime.basePrice + dayAdjustment + seatSurcharge,
          );

          return {
            seatShowtimeId: ss?.seatShowtimeId ?? `${showtimeId}_${seat.seatId}`,
            seatId: seat.seatId,
            seatCode: `${seat.rowPosition}${seat.columnPosition}`,
            rowPosition: seat.rowPosition,
            columnPosition: seat.columnPosition,
            seatType: seat.seatType,
            roomSeatStatus: seat.status,
            bookingStatus,
            isSelectable,
            price,
          };
        });

      const totalSeats = mappedSeats.length;
      const availableSeats = mappedSeats.filter((s) => s.isSelectable).length;

      const showtimeView: PublicShowtimeItemDto = {
        showtimeId: showtime.showtimeId,
        movieId: showtime.movieId,
        movieName: movie?.movieName ?? 'Phim không xác định',
        duration: movie?.duration ?? 0,
        movieStatus: movie?.status ?? MovieStatus.NOW_SHOWING,
        posterKey: movie?.posterKey ?? null,
        branchId: branch?.branchId ?? room.branchId,
        branchName: branch?.branchName ?? 'Rạp Lotte Cinema',
        branchAddress: branch?.address ?? '',
        roomId: room.roomId,
        roomName: room.roomName,
        startTime: showtime.startTime,
        endTime: showtime.endTime,
        basePrice: showtime.basePrice,
        totalSeats,
        availableSeats,
      };

      return {
        showtime: showtimeView,
        seats: mappedSeats,
        pricing: {
          basePrice: showtime.basePrice,
          dayAdjustment,
          seatAdjustments,
        },
      };
    });
  }

  private async enrichPublicShowtimes(
    showtimes: Showtime[],
    rooms: {
      roomId: string;
      roomName: string;
      roomStatus: RoomStatus;
      branchId: string;
    }[],
    branches: ManagerBranchDto[],
    movies: ShowtimeMovieOptionDto[],
  ): Promise<PublicShowtimeItemDto[]> {
    if (showtimes.length === 0) return [];

    const showtimeIds = showtimes.map((s) => s.showtimeId);
    const roomIds = Array.from(new Set(showtimes.map((s) => s.roomId)));

    const [seatStats, roomSeatCounts] = await Promise.all([
      this.seatShowtimeModel.aggregate<{
        _id: string;
        totalSeats: number;
        unavailableSeats: number;
      }>([
        { $match: { showtimeId: { $in: showtimeIds } } },
        {
          $group: {
            _id: '$showtimeId',
            totalSeats: { $sum: 1 },
            unavailableSeats: {
              $sum: {
                $cond: [
                  { $ne: ['$seatStatus', SeatShowtimeStatus.EMPTY] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      this.seatModel.aggregate<{
        _id: string;
        totalRoomSeats: number;
        maintenanceSeats: number;
      }>([
        { $match: { roomId: { $in: roomIds } } },
        {
          $group: {
            _id: '$roomId',
            totalRoomSeats: { $sum: 1 },
            maintenanceSeats: {
              $sum: {
                $cond: [{ $ne: ['$status', SeatStatus.AVAILABLE] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const roomMap = new Map(rooms.map((r) => [r.roomId, r]));
    const branchMap = new Map(branches.map((b) => [b.branchId, b]));
    const movieMap = new Map(movies.map((m) => [m.movieId, m]));
    const seatStatMap = new Map(seatStats.map((s) => [s._id, s]));
    const roomSeatCountMap = new Map(roomSeatCounts.map((r) => [r._id, r]));

    return showtimes.map((showtime) => {
      const room = roomMap.get(showtime.roomId);
      const branch = room ? branchMap.get(room.branchId) : undefined;
      const movie = movieMap.get(showtime.movieId);
      const stat = seatStatMap.get(showtime.showtimeId);
      const roomSeatStat = roomSeatCountMap.get(showtime.roomId);

      const totalSeats =
        stat?.totalSeats ?? roomSeatStat?.totalRoomSeats ?? 60;
      const unavailableSeats =
        stat?.unavailableSeats ?? roomSeatStat?.maintenanceSeats ?? 0;

      return {
        showtimeId: showtime.showtimeId,
        movieId: showtime.movieId,
        movieName: movie?.movieName ?? 'Phim không xác định',
        duration: movie?.duration ?? 0,
        movieStatus: movie?.status ?? MovieStatus.NOW_SHOWING,
        posterKey: movie?.posterKey ?? null,
        branchId: branch?.branchId ?? room?.branchId ?? '',
        branchName: branch?.branchName ?? 'Rạp Lotte Cinema',
        branchAddress: branch?.address ?? '',
        roomId: showtime.roomId,
        roomName: room?.roomName ?? 'Phòng chiếu',
        startTime: showtime.startTime,
        endTime: showtime.endTime,
        basePrice: showtime.basePrice,
        totalSeats,
        availableSeats: Math.max(0, totalSeats - unavailableSeats),
      };
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
          SHOWTIME_MESSAGES.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }
}
