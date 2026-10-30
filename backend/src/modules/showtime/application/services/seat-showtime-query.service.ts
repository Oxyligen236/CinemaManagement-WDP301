import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SeatShowtimeResDto } from '../dto/res.dto';
import { GetShowtimeSeatsUsecase } from '../usecase/get-showtime-seats.usecase';

@Injectable()
export class SeatShowtimeQueryService implements GetShowtimeSeatsUsecase {
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
        const dto = new SeatShowtimeResDto();
        dto.seatShowtimeId = item.id;
        dto.showtimeId = item.showtimeId;
        dto.seatId = item.seatId;
        dto.seatStatus = item.seatStatus as any;
        dto.rowPosition = item.seat.rowPosition;
        dto.columnPosition = item.seat.columnPosition;
        dto.seatType = item.seat.seatType as any;
        return [dto];
      })
      .sort(
        (a, b) =>
          a.rowPosition.localeCompare(b.rowPosition) ||
          a.columnPosition - b.columnPosition,
      );
  }
}
