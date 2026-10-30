import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
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

    const branchFilter = isValidObjectId(branchId)
      ? { $or: [{ _id: new Types.ObjectId(branchId) }, { branchId }] }
      : { branchId };

    const branch = await this.branchModel
      .findOne(branchFilter)
      .select('_id branchId branchName')
      .lean()
      .exec();

    const rooms = await this.roomModel
      .find({
        ...branchFilter,
        roomStatus: RoomStatus.AVAILABLE,
      })
      .select('_id roomId roomName branchId')
      .lean()
      .exec();

    if (rooms.length === 0) {
      return [];
    }

    const roomObjIds: (Types.ObjectId | string)[] = [];
    const roomMap = new Map<string, (typeof rooms)[0]>();
    for (const r of rooms) {
      if (r._id) {
        roomObjIds.push(r._id);
        roomMap.set(r._id.toString(), r);
      }
      if ((r as any).roomId) {
        roomObjIds.push((r as any).roomId);
        roomMap.set((r as any).roomId, r);
      }
    }

    const now = targetDate ? new Date(targetDate) : new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const showtimes = await this.showtimeModel
      .find({
        roomId: { $in: roomObjIds },
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
      .find({
        $or: [
          {
            _id: {
              $in: movieIds
                .filter(isValidObjectId)
                .map((id) => new Types.ObjectId(id as any)),
            },
          },
          { movieId: { $in: movieIds.map((id) => id.toString()) } } as any,
        ],
      })
      .lean()
      .exec();
    const movieMap = new Map<string, (typeof movies)[0]>();
    for (const m of movies) {
      const idStr = m._id?.toString() ?? (m as any).movieId ?? '';
      movieMap.set(idStr, m);
      if ((m as any).movieId) movieMap.set((m as any).movieId, m);
    }

    const showtimeObjectIds = showtimes.map(
      (s) => s._id ?? (s as any).showtimeId,
    );
    const seatShowtimes = await this.seatShowtimeModel
      .find({
        $or: [
          {
            showtimeId: {
              $in: showtimeObjectIds
                .filter(isValidObjectId)
                .map((id) => new Types.ObjectId(id as any)),
            },
          },
          {
            showtimeId: { $in: showtimeObjectIds.map((id) => id.toString()) },
          } as any,
        ],
      })
      .select('showtimeId seatStatus')
      .lean()
      .exec();

    const seatShowtimeStatsByShowtime = new Map<
      string,
      { total: number; available: number }
    >();

    for (const ss of seatShowtimes) {
      const stIdStr = ss.showtimeId.toString();
      let stats = seatShowtimeStatsByShowtime.get(stIdStr);
      if (!stats) {
        stats = { total: 0, available: 0 };
        seatShowtimeStatsByShowtime.set(stIdStr, stats);
      }
      stats.total += 1;
      if (ss.seatStatus === SeatShowtimeStatus.EMPTY) {
        stats.available += 1;
      }
    }

    const roomsNeedingSeatCount = [
      ...new Set(
        showtimes
          .filter(
            (s) =>
              !seatShowtimeStatsByShowtime.has(
                s._id?.toString() ?? (s as any).showtimeId ?? '',
              ),
          )
          .map((s) => s.roomId),
      ),
    ];

    const roomSeatStats = new Map<
      string,
      { total: number; available: number }
    >();

    if (roomsNeedingSeatCount.length > 0) {
      const roomSeats = await this.seatModel
        .find({
          $or: [
            {
              roomId: {
                $in: roomsNeedingSeatCount
                  .filter(isValidObjectId)
                  .map((id) => new Types.ObjectId(id as any)),
              },
            },
            {
              roomId: { $in: roomsNeedingSeatCount.map((id) => id.toString()) },
            } as any,
          ],
        })
        .select('roomId status')
        .lean()
        .exec();

      for (const seat of roomSeats) {
        const rIdStr = seat.roomId.toString();
        let stats = roomSeatStats.get(rIdStr);
        if (!stats) {
          stats = { total: 0, available: 0 };
          roomSeatStats.set(rIdStr, stats);
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
      const stIdStr = st._id?.toString() ?? (st as any).showtimeId ?? '';
      const rIdStr = st.roomId?.toString() ?? (st as any).roomId ?? '';
      const mIdStr = st.movieId?.toString() ?? (st as any).movieId ?? '';
      const movie = movieMap.get(mIdStr);
      const stats = seatShowtimeStatsByShowtime.get(stIdStr) ||
        roomSeatStats.get(rIdStr) || { total: 0, available: 0 };
      const room = roomMap.get(rIdStr);

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

      return StaffShowtimeItemResDto.from({
        showtimeId: stIdStr,
        movieId: mIdStr,
        movieTitle: movie?.movieName || 'Unknown',
        moviePosterUrl,
        roomId: rIdStr,
        roomName: room?.roomName || 'Cinema',
        branchId,
        branchName,
        startTime: st.startTime,
        endTime: st.endTime,
        basePrice: st.basePrice,
        format: '2D',
        availableSeats: stats.available,
        totalSeats: stats.total,
      });
    });
  }
}
