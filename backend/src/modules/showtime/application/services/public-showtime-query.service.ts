import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Genre, GenreDocument } from '../../../movie/domain/schemas/genre.schema';
import { Movie, MovieDocument } from '../../../movie/domain/schemas/movie.schema';
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
  ) {}

  async getPublicShowtimes(
    query: GetPublicShowtimesReqDto,
  ): Promise<PublicShowtimeItemResDto[]> {
    const filter: Record<string, unknown> = {};
    const roomMap = new Map<string, string>();

    if (query.branchId) {
      const rooms = await this.roomModel
        .find({
          branchId: query.branchId,
          roomStatus: RoomStatus.AVAILABLE,
        })
        .select('roomId roomName')
        .lean()
        .exec();

      if (rooms.length === 0) {
        return [];
      }

      for (const r of rooms) {
        roomMap.set(r.roomId, r.roomName);
      }
      filter.roomId = { $in: rooms.map((r) => r.roomId) };
    }

    if (query.movieId) {
      filter.movieId = query.movieId;
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
      .filter((id) => !roomMap.has(id));

    if (missingRoomIds.length > 0) {
      const extraRooms = await this.roomModel
        .find({ roomId: { $in: missingRoomIds } })
        .select('roomId roomName')
        .lean()
        .exec();
      for (const r of extraRooms) {
        roomMap.set(r.roomId, r.roomName);
      }
    }

    const movieIds = [...new Set(showtimes.map((s) => s.movieId))];
    const movies = await this.movieModel
      .find({ movieId: { $in: movieIds } })
      .lean()
      .exec();
    const movieMap = new Map(movies.map((m) => [m.movieId, m]));

    const allGenreIds = [
      ...new Set(movies.flatMap((m) => m.genreIds || [])),
    ];
    let genreMap = new Map<string, string>();
    if (allGenreIds.length > 0) {
      const genres = await this.genreModel
        .find({ genreId: { $in: allGenreIds } })
        .select('genreId genreName')
        .lean()
        .exec();
      genreMap = new Map(genres.map((g) => [g.genreId, g.genreName]));
    }

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

    return showtimes.map((st) => {
      const movie = movieMap.get(st.movieId);
      const stats =
        seatShowtimeStatsByShowtime.get(st.showtimeId) ||
        roomSeatStats.get(st.roomId) || { total: 0, available: 0 };

      const item = new PublicShowtimeItemResDto();
      item.showtimeId = st.showtimeId;
      item.movieId = st.movieId;
      item.movieName = movie?.movieName || 'Unknown';
      item.duration = movie?.duration || 120;
      item.posterUrl = movie?.posterUrl;
      item.genreNames =
        movie?.genreIds
          ?.map((gid) => genreMap.get(gid))
          .filter((name): name is string => Boolean(name)) || [];
      item.roomId = st.roomId;
      item.roomName = roomMap.get(st.roomId) || 'Cinema';
      item.startTime = st.startTime;
      item.endTime = st.endTime;
      item.basePrice = st.basePrice;
      item.availableSeats = stats.available;
      item.totalSeats = stats.total;
      return item;
    });
  }
}
