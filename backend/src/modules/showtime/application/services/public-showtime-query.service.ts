import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RoomStatus, SeatStatus, SeatShowtimeStatus } from '@prisma/client';
import { GetPublicShowtimesReqDto } from '../dto/req.dto';
import { PublicShowtimeItemResDto } from '../dto/res.dto';
import { GetPublicShowtimesUsecase } from '../usecase/get-public-showtimes.usecase';

@Injectable()
export class PublicShowtimeQueryService implements GetPublicShowtimesUsecase {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicShowtimes(
    query: GetPublicShowtimesReqDto,
  ): Promise<PublicShowtimeItemResDto[]> {
    const where: any = {};
    const roomMap = new Map<string, { roomName: string; branchId: string }>();

    if (query.branchId) {
      const rooms = await this.prisma.room.findMany({
        where: {
          branchId: query.branchId,
          roomStatus: RoomStatus.AVAILABLE,
        },
        select: { id: true, roomName: true, branchId: true },
      });

      if (rooms.length === 0) {
        return [];
      }

      for (const r of rooms) {
        roomMap.set(r.id, {
          roomName: r.roomName,
          branchId: r.branchId,
        });
      }
      where.roomId = { in: rooms.map((r) => r.id) };
    }

    if (query.movieId) {
      where.movieId = query.movieId;
    }

    if (query.date) {
      const dateOnly = query.date.split('T')[0];
      const [year, month, day] = dateOnly.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
        where.startTime = { gte: start, lt: end };
      }
    }

    const showtimes = await this.prisma.showtime.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });

    if (showtimes.length === 0) {
      return [];
    }

    const missingRoomIds = showtimes
      .map((s) => s.roomId)
      .filter((id) => !roomMap.has(id));

    if (missingRoomIds.length > 0) {
      const extraRooms = await this.prisma.room.findMany({
        where: { id: { in: missingRoomIds } },
        select: { id: true, roomName: true, branchId: true },
      });
      for (const r of extraRooms) {
        roomMap.set(r.id, {
          roomName: r.roomName,
          branchId: r.branchId,
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
    let branchMap = new Map<string, string>();
    if (branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, branchName: true },
      });
      branchMap = new Map(branches.map((b) => [b.id, b.branchName]));
    }

    const movieIds = [...new Set(showtimes.map((s) => s.movieId))];
    const movies = await this.prisma.movie.findMany({
      where: { id: { in: movieIds } },
    });
    const movieMap = new Map(movies.map((m) => [m.id, m]));

    const allGenreIds = [...new Set(movies.flatMap((m) => m.genreIds || []))];
    let genreMap = new Map<string, string>();
    if (allGenreIds.length > 0) {
      const genres = await this.prisma.genre.findMany({
        where: { id: { in: allGenreIds } },
        select: { id: true, genreName: true },
      });
      genreMap = new Map(genres.map((g) => [g.id, g.genreName]));
    }

    const showtimeIds = showtimes.map((s) => s.id);
    const seatShowtimes = await this.prisma.seatShowtime.findMany({
      where: { showtimeId: { in: showtimeIds } },
      select: { showtimeId: true, seatStatus: true },
    });

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
          .filter((s) => !seatShowtimeStatsByShowtime.has(s.id))
          .map((s) => s.roomId),
      ),
    ];

    const roomSeatStats = new Map<
      string,
      { total: number; available: number }
    >();

    if (roomsNeedingSeatCount.length > 0) {
      const roomSeats = await this.prisma.seat.findMany({
        where: { roomId: { in: roomsNeedingSeatCount } },
        select: { roomId: true, status: true },
      });

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
        seatShowtimeStatsByShowtime.get(st.id) ||
        roomSeatStats.get(st.roomId) || { total: 0, available: 0 };
      const roomInfo = roomMap.get(st.roomId);

      const item = new PublicShowtimeItemResDto();
      item.showtimeId = st.id;
      item.movieId = st.movieId;
      item.movieName = movie?.movieName || 'Unknown';
      item.duration = movie?.duration || 120;
      const rawPoster = movie?.posterKey;
      const pubStorageUrl =
        process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, '') || '';
      item.posterUrl = rawPoster
        ? rawPoster.startsWith('http') || rawPoster.startsWith('/')
          ? rawPoster
          : `${pubStorageUrl}/${rawPoster}`
        : undefined;
      item.genreNames =
        movie?.genreIds
          ?.map((gid) => genreMap.get(gid))
          .filter((name): name is string => Boolean(name)) || [];
      item.roomId = st.roomId;
      item.roomName = roomInfo?.roomName || 'Cinema';
      item.branchId = roomInfo?.branchId;
      item.branchName = roomInfo?.branchId
        ? branchMap.get(roomInfo.branchId)
        : undefined;
      item.startTime = st.startTime;
      item.endTime = st.endTime;
      item.basePrice = st.basePrice;
      item.availableSeats = stats.available;
      item.totalSeats = stats.total;
      return item;
    });
  }
}
