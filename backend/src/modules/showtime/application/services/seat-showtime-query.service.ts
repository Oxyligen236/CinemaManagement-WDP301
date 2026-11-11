import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SeatShowtimeResDto } from '../dto/res.dto';

@Injectable()
export class SeatShowtimeQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getShowtimeSeats(showtimeId: string): Promise<SeatShowtimeResDto[]> {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: showtimeId },
      select: { id: true },
    });
    if (!showtime) {
      throw new NotFoundException('Showtime not found');
    }

    const seatShowtimes = await this.prisma.seatShowtime.findMany({
      where: { showtimeId },
      include: { seat: true },
    });

    return seatShowtimes
      .flatMap((item) => {
        if (!item.seat) return [];
        return [
          SeatShowtimeResDto.of(
            item.id,
            item.showtimeId,
            item.seatId,
            item.seatStatus as any,
            item.seat.rowPosition,
            item.seat.columnPosition,
            item.seat.seatType as any,
          ),
        ];
      })
      .sort(
        (a, b) =>
          a.rowPosition.localeCompare(b.rowPosition) ||
          a.columnPosition - b.columnPosition,
      );
  }
}
