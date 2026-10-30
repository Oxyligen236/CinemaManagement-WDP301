import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  Branch,
  BranchDocument,
} from '../../../branch/domain/schemas/branch.schema';
import {
  Genre,
  GenreDocument,
} from '../../../movie/domain/schemas/genre.schema';
import {
  Movie,
  MovieDocument,
} from '../../../movie/domain/schemas/movie.schema';
import { RoomStatus } from '../../../room/domain/enums/room-status.enum';
import { SeatStatus } from '../../../room/domain/enums/seat-status.enum';
import { Room, RoomDocument } from '../../../room/domain/schemas/room.schema';
import { Seat, SeatDocument } from '../../../room/domain/schemas/seat.schema';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import {
  SeatShowtime,
  SeatShowtimeDocument,
} from '../../domain/schemas/seat-showtime.schema';
import {
  Showtime,
  ShowtimeDocument,
} from '../../domain/schemas/showtime.schema';
import { GetPublicShowtimesReqDto } from '../dto/req.dto';
import { PublicShowtimeItemResDto } from '../dto/res.dto';
import { GetPublicShowtimesUsecase } from '../usecase/get-public-showtimes.usecase';

@Injectable()
export class PublicShowtimeQueryService implements GetPublicShowtimesUsecase {
  constructor(
    @InjectModel(Showtime.name)
    private readonly showtimeModel: Model<ShowtimeDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Movie.name)
    private readonly movieModel: Model<MovieDocument>,
    @InjectModel(Genre.name)
    private readonly genreModel: Model<GenreDocument>,
    @InjectModel(SeatShowtime.name)
    private readonly seatShowtimeModel: Model<SeatShowtimeDocument>,
    @InjectModel(Seat.name)
    private readonly seatModel: Model<SeatDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async getPublicShowtimes(
    query: GetPublicShowtimesReqDto,
  ): Promise<PublicShowtimeItemResDto[]> {
    const filter: Record<string, unknown> = {};
    const roomMap = new Map<string, { roomName: string; branchId: string }>();

    if (query.branchId) {
      const branchFilter = isValidObjectId(query.branchId)
        ? {
            $or: [
              { branchId: new Types.ObjectId(query.branchId) },
              { branchId: query.branchId },
            ],
            roomStatus: RoomStatus.AVAILABLE,
          }
        : {
            branchId: query.branchId,
            roomStatus: RoomStatus.AVAILABLE,
          };

      const rooms = await this.roomModel
        .find(branchFilter)
        .select('_id roomName branchId')
        .lean()
        .exec();

      if (rooms.length === 0) {
        return [];
      }

      const roomObjIds: (Types.ObjectId | string)[] = [];
      for (const r of rooms) {
        const idStr = r._id?.toString() ?? (r as any).roomId ?? '';
        roomMap.set(idStr, {
          roomName: r.roomName,
          branchId: r.branchId?.toString() ?? '',
        });
        if (r._id) {
          roomObjIds.push(r._id);
        } else if ((r as any).roomId) {
          roomObjIds.push((r as any).roomId);
        }
      }
      filter.roomId = { $in: roomObjIds };
    }

    if (query.movieId) {
      filter.movieId = isValidObjectId(query.movieId)
        ? new Types.ObjectId(query.movieId)
        : query.movieId;
    }

    if (query.date) {
      const dateOnly = query.date.split('T')[0];
      const [year, month, day] = dateOnly.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
        filter.startTime = { $gte: start, $lt: end };
      }
    }

    const showtimes = await this.showtimeModel
      .find(filter)
      .sort({ startTime: 1 })
      .lean()
      .exec();

    if (showtimes.length === 0) {
      return [];
    }

    const missingRoomIds = showtimes
      .map((s) => s.roomId)
      .filter((id) => Boolean(id) && !roomMap.has(id.toString()));

    if (missingRoomIds.length > 0) {
      const extraRooms = await this.roomModel
        .find({
          $or: [
            {
              _id: {
                $in: missingRoomIds
                  .filter(isValidObjectId)
                  .map((id) => new Types.ObjectId(id as any)),
              },
            },
            {
              roomId: { $in: missingRoomIds.map((id) => id.toString()) },
            } as any,
          ],
        })
        .select('_id roomName branchId')
        .lean()
        .exec();
      for (const r of extraRooms) {
        const idStr = r._id?.toString() ?? (r as any).roomId ?? '';
        roomMap.set(idStr, {
          roomName: r.roomName,
          branchId: r.branchId?.toString() ?? '',
        });
      }
    }

    const branchIds = [
      ...new Set(
        Array.from(roomMap.values())
          .map((r) => r.branchId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const branchMap = new Map<string, string>();
    if (branchIds.length > 0) {
      const branches = await this.branchModel
        .find({
          $or: [
            {
              _id: {
                $in: branchIds
                  .filter(isValidObjectId)
                  .map((id) => new Types.ObjectId(id)),
              },
            },
            { branchId: { $in: branchIds } } as any,
          ],
        })
        .select('_id branchName')
        .lean()
        .exec();
      for (const b of branches) {
        branchMap.set(
          b._id?.toString() ?? (b as any).branchId ?? '',
          b.branchName,
        );
        if ((b as any).branchId)
          branchMap.set((b as any).branchId, b.branchName);
      }
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

    const allGenreIds = [...new Set(movies.flatMap((m) => m.genreIds || []))];
    const genreMap = new Map<string, string>();
    if (allGenreIds.length > 0) {
      const genres = await this.genreModel
        .find({
          $or: [
            {
              _id: {
                $in: allGenreIds
                  .filter(isValidObjectId)
                  .map((id) => new Types.ObjectId(id as any)),
              },
            },
            { genreId: { $in: allGenreIds.map((id) => id.toString()) } } as any,
          ],
        })
        .select('_id genreName')
        .lean()
        .exec();
      for (const g of genres) {
        const idStr = g._id?.toString() ?? (g as any).genreId ?? '';
        genreMap.set(idStr, g.genreName);
        if ((g as any).genreId) genreMap.set((g as any).genreId, g.genreName);
      }
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

    return showtimes.map((st) => {
      const stIdStr = st._id?.toString() ?? (st as any).showtimeId ?? '';
      const rIdStr = st.roomId?.toString() ?? (st as any).roomId ?? '';
      const mIdStr = st.movieId?.toString() ?? (st as any).movieId ?? '';
      const movie = movieMap.get(mIdStr);
      const stats = seatShowtimeStatsByShowtime.get(stIdStr) ||
        roomSeatStats.get(rIdStr) || { total: 0, available: 0 };
      const roomInfo = roomMap.get(rIdStr);

      const moviePoster = movie as unknown as {
        posterKey?: string;
        posterUrl?: string;
      };
      const rawPoster = moviePoster?.posterKey || moviePoster?.posterUrl;
      const pubStorageUrl =
        process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, '') || '';
      const posterUrl = rawPoster
        ? rawPoster.startsWith('http') || rawPoster.startsWith('/')
          ? rawPoster
          : `${pubStorageUrl}/${rawPoster}`
        : undefined;

      const genreNames =
        movie?.genreIds
          ?.map((gid) => genreMap.get(gid.toString()))
          .filter((name): name is string => Boolean(name)) || [];

      return PublicShowtimeItemResDto.from({
        showtimeId: stIdStr,
        movieId: mIdStr,
        movieName: movie?.movieName || 'Unknown',
        duration: movie?.duration || 120,
        posterUrl,
        genreNames,
        roomId: rIdStr,
        roomName: roomInfo?.roomName || 'Cinema',
        branchId: roomInfo?.branchId,
        branchName: roomInfo?.branchId
          ? branchMap.get(roomInfo.branchId)
          : undefined,
        startTime: st.startTime,
        endTime: st.endTime,
        basePrice: st.basePrice,
        availableSeats: stats.available,
        totalSeats: stats.total,
      });
    });
  }
}
