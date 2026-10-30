import { Injectable, NotFoundException } from '@nestjs/common';
import { Page } from '../../../../common/dto/page.dto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SearchShowtimeReqDto } from '../dto/req.dto';
import { ShowtimeResDto } from '../dto/res.dto';
import { toShowtimeResDto } from '../helpers/showtime-res.mapper';
import { GetShowtimeDetailUsecase } from '../usecase/get-showtime-detail.usecase';
import { SearchShowtimesUsecase } from '../usecase/search-showtimes.usecase';

@Injectable()
export class ShowtimeQueryService
  implements SearchShowtimesUsecase, GetShowtimeDetailUsecase
{
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveShowtimes(movieId: string): Promise<boolean> {
    const found = await this.prisma.showtime.findFirst({
      where: {
        movieId,
        endTime: { gte: new Date() },
      },
      select: { id: true },
    });
    return found !== null;
  }

  async searchShowtimes(
    query: SearchShowtimeReqDto,
  ): Promise<Page<ShowtimeResDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: any = {};

    if (query.movieId) {
      where.movieId = query.movieId;
    }
    if (query.branchId) {
      const rooms = await this.prisma.room.findMany({
        where: { branchId: query.branchId },
        select: { id: true },
      });
      let roomIds = rooms.map((room) => room.id);
      if (query.roomId) {
        roomIds = roomIds.filter((id) => id === query.roomId);
      }
      where.roomId = { in: roomIds };
    } else if (query.roomId) {
      where.roomId = query.roomId;
    }

    if (query.date) {
      const start = new Date(query.date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      where.startTime = { gte: start, lt: end };
    } else {
      const startTimeCondition: any = {};
      if (query.from) {
        startTimeCondition.gte = new Date(query.from);
      }
      if (query.to) {
        startTimeCondition.lte = new Date(query.to);
      }
      if (Object.keys(startTimeCondition).length > 0) {
        where.startTime = startTimeCondition;
      }
    }

    const [docs, total] = await Promise.all([
      this.prisma.showtime.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.showtime.count({ where }),
    ]);

    return Page.from(
      docs.map((doc) => toShowtimeResDto(doc)),
      total,
      page,
      limit,
    );
  }

  async searchShowtimesByRooms(
    roomIds: string[],
    filter: { movieId?: string; roomId?: string; from?: Date; to?: Date },
    page: number = 1,
    limit: number = 10,
  ): Promise<Page<ShowtimeResDto>> {
    const targetRoomIds = filter.roomId
      ? roomIds.filter((id) => id === filter.roomId)
      : roomIds;

    const where: any = {
      roomId: { in: targetRoomIds },
    };

    if (filter.movieId) {
      where.movieId = filter.movieId;
    }

    if (filter.from || filter.to) {
      const timeFilter: any = {};
      if (filter.from) timeFilter.gte = filter.from;
      if (filter.to) timeFilter.lte = filter.to;
      where.startTime = timeFilter;
    }

    const [docs, total] = await Promise.all([
      this.prisma.showtime.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.showtime.count({ where }),
    ]);

    return Page.from(
      docs.map((doc) => toShowtimeResDto(doc)),
      total,
      page,
      limit,
    );
  }

  async getShowtimeDetail(showtimeId: string): Promise<ShowtimeResDto> {
    const doc = await this.prisma.showtime.findUnique({
      where: { id: showtimeId },
    });
    if (!doc) {
      throw new NotFoundException('Showtime not found');
    }
    return toShowtimeResDto(doc);
  }
}
