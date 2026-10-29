import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Branch,
  BranchDocument,
} from '../../../branch/domain/schemas/branch.schema';
import {
  Movie,
  MovieDocument,
} from '../../../movie/domain/schemas/movie.schema';
import { RoomStatus } from '../../../room/domain/enums/room-status.enum';
import { SeatStatus } from '../../../room/domain/enums/seat-status.enum';
import { Room, RoomDocument } from '../../../room/domain/schemas/room.schema';
import { Seat, SeatDocument } from '../../../room/domain/schemas/seat.schema';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../../domain/schemas/seat-showtime.schema';
import {
  Showtime,
  ShowtimeDocument,
} from '../../domain/schemas/showtime.schema';
import { StaffShowtimeItemResDto } from '../dto/res.dto';
import { GetStaffTodayShowtimesUsecase } from '../usecase/get-staff-today-showtimes.usecase';

@Injectable()
export class StaffShowtimeQueryService implements GetStaffTodayShowtimesUsecase {
  constructor(
    private readonly userBranchQueryService: UserBranchQueryService,
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Movie.name)
    private readonly movieModel: Model<MovieDocument>,
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
    @InjectModel(Seat.name)
    private readonly seatModel: Model<SeatDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async getStaffTodayShowtimes(
    staffUserId: string,
    targetDate?: Date | string,
  ): Promise<StaffShowtimeItemResDto[]> {
    const branchId =
      await this.userBranchQueryService.getBranchIdOfUser(staffUserId);

    if (!branchId) {
      throw new ForbiddenException(
        'Tài khoản nhân viên chưa được gán chi nhánh hoạt động',
      );
    }

    const branch = await this.branchModel
      .findOne({ branchId })
      .select('branchId branchName')
      .lean()
      .exec();

    const rooms = await this.roomModel
      .find({
        branchId,
        roomStatus: RoomStatus.AVAILABLE,
      })
      .select('roomId roomName branchId')
      .lean()
      .exec();

    if (rooms.length === 0) {
      return [];
    }

    const roomIds = rooms.map((r) => r.roomId);
    const roomMap = new Map(rooms.map((r) => [r.roomId, r]));

    const now = targetDate ? new Date(targetDate) : new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const showtimes = await this.showtimeModel
      .find({
        roomId: { $in: roomIds },
        startTime: { $gte: start, $lt: end },
      })
      .sort({ startTime: 1 })
      .lean()
      .exec();

    if (showtimes.length === 0) {
      return [];
    }

    const movieIds = [...new Set(showtimes.map((s) => s.movieId))];
    const movies = await this.movieModel
      .find({ movieId: { $in: movieIds } })
      .lean()
      .exec();
    const movieMap = new Map(movies.map((m) => [m.movieId, m]));

    const showtimeIds = showtimes.map((s) => s.showtimeId);
    const seatShowtimes = await this.seatShowtimeModel
      .find({ showtimeId: { $in: showtimeIds } })
      .select('showtimeId seatStatus')
      .lean()
      .exec();

    const seatShowtimeStatsByShowtime = new Map<
      string,
      { total: number; available: number }
    >();

    for (const ss of seatShowtimes) {
      let stats = seatShowtimeStatsByShowtime.get(ss.showtimeId);
      if (!stats) {
        stats = { total: 0, available: 0 };
        seatShowtimeStatsByShowtime.set(ss.showtimeId, stats);
      }
      stats.total += 1;
      if (ss.seatStatus === SeatShowtimeStatus.EMPTY) {
        stats.available += 1;
      }
    }

    const roomsNeedingSeatCount = [
      ...new Set(
        showtimes
          .filter((s) => !seatShowtimeStatsByShowtime.has(s.showtimeId))
          .map((s) => s.roomId),
      ),
    ];

    const roomSeatStats = new Map<
      string,
      { total: number; available: number }
    >();

    if (roomsNeedingSeatCount.length > 0) {
      const roomSeats = await this.seatModel
        .find({ roomId: { $in: roomsNeedingSeatCount } })
        .select('roomId status')
        .lean()
        .exec();

      for (const seat of roomSeats) {
        let stats = roomSeatStats.get(seat.roomId);
        if (!stats) {
          stats = { total: 0, available: 0 };
          roomSeatStats.set(seat.roomId, stats);
        }
        stats.total += 1;
        if (seat.status === SeatStatus.AVAILABLE) {
          stats.available += 1;
        }
      }
    }

    const pubStorageUrl =
      process.env.STORAGE_PUBLIC_URL?.trim().replace(/\/+$/, '') || '';
    const branchName = branch?.branchName || '';

    return showtimes.map((st) => {
      const movie = movieMap.get(st.movieId);
      const stats = seatShowtimeStatsByShowtime.get(st.showtimeId) ||
        roomSeatStats.get(st.roomId) || { total: 0, available: 0 };
      const room = roomMap.get(st.roomId);

      const moviePoster = movie as unknown as {
        posterKey?: string;
        posterUrl?: string;
      };
      const rawPoster = moviePoster?.posterKey || moviePoster?.posterUrl;
      let moviePosterUrl: string | null = null;
      if (rawPoster) {
        const value = rawPoster.trim();
        if (/^https?:\/\//i.test(value)) {
          moviePosterUrl = value;
        } else if (pubStorageUrl) {
          const key = value.replace(/^\/+/, '');
          moviePosterUrl = key ? `${pubStorageUrl}/${key}` : null;
        }
      }

      const item = new StaffShowtimeItemResDto();
      item.showtimeId = st.showtimeId;
      item.movieId = st.movieId;
      item.movieTitle = movie?.movieName || 'Unknown';
      item.moviePosterUrl = moviePosterUrl;
      item.roomId = st.roomId;
      item.roomName = room?.roomName || 'Cinema';
      item.branchId = branchId;
      item.branchName = branchName;
      item.startTime = st.startTime;
      item.endTime = st.endTime;
      item.basePrice = st.basePrice;
      item.format = '2D';
      item.availableSeats = stats.available;
      item.totalSeats = stats.total;
      return item;
    });
  }
}
