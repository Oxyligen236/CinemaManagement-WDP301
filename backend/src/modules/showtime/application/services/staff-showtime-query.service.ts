import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RoomStatus, SeatStatus, SeatShowtimeStatus } from '@prisma/client';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { StaffShowtimeItemResDto } from '../dto/res.dto';
import { GetStaffTodayShowtimesUsecase } from '../usecase/get-staff-today-showtimes.usecase';

@Injectable()
export class StaffShowtimeQueryService implements GetStaffTodayShowtimesUsecase {
  constructor(
    private readonly userBranchQueryService: UserBranchQueryService,
    private readonly prisma: PrismaService,
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

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, branchName: true },
    });

    const rooms = await this.prisma.room.findMany({
      where: {
        branchId,
        roomStatus: RoomStatus.AVAILABLE,
      },
      select: { id: true, roomName: true, branchId: true },
    });

    if (rooms.length === 0) {
      return [];
    }

    const roomIds = rooms.map((r) => r.id);
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    const now = targetDate ? new Date(targetDate) : new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const showtimes = await this.prisma.showtime.findMany({
      where: {
        roomId: { in: roomIds },
        startTime: { gte: start, lt: end },
      },
      orderBy: { startTime: 'asc' },
    });

    if (showtimes.length === 0) {
      return [];
    }

    const movieIds = [...new Set(showtimes.map((s) => s.movieId))];
    const movies = await this.prisma.movie.findMany({
      where: { id: { in: movieIds } },
    });
    const movieMap = new Map(movies.map((m) => [m.id, m]));

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

    const pubStorageUrl =
      process.env.STORAGE_PUBLIC_URL?.trim().replace(/\/+$/, '') || '';
    const branchName = branch?.branchName || '';

    return showtimes.map((st) => {
      const movie = movieMap.get(st.movieId);
      const room = roomMap.get(st.roomId);
      const stats =
        seatShowtimeStatsByShowtime.get(st.id) ||
        roomSeatStats.get(st.roomId) || { total: 0, available: 0 };

      const rawPoster = movie?.posterKey;
      const posterUrl = rawPoster
        ? rawPoster.startsWith('http') || rawPoster.startsWith('/')
          ? rawPoster
          : `${pubStorageUrl}/${rawPoster}`
        : undefined;

      const item = new StaffShowtimeItemResDto();
      item.showtimeId = st.id;
      item.movieId = st.movieId;
      item.movieTitle = movie?.movieName || 'Unknown';
      item.moviePosterUrl = posterUrl ?? null;
      item.roomId = st.roomId;
      item.roomName = room?.roomName || 'Cinema';
      item.branchId = branchId;
      item.branchName = branchName;
      item.startTime = st.startTime;
      item.endTime = st.endTime;
      item.basePrice = st.basePrice;
      item.availableSeats = stats.available;
      item.totalSeats = stats.total;
      return item;
    });
  }
}
