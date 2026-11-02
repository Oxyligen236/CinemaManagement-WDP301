import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SeatShowtimeDetailDto, ShowtimeContract } from './showtime.contract';

@Injectable()
export class ShowtimeContractImpl implements ShowtimeContract {
  constructor(private readonly prisma: PrismaService) {}

  async getSeatShowtimeDetail(
    seatShowtimeId: string,
  ): Promise<SeatShowtimeDetailDto | null> {
    const seatShowtime = await this.prisma.seatShowtime.findUnique({
      where: { id: seatShowtimeId },
      include: {
        showtime: {
          include: {
            movie: true,
            room: {
              include: {
                branch: true,
              },
            },
          },
        },
        seat: true,
      },
    });

    if (!seatShowtime || !seatShowtime.showtime || !seatShowtime.seat)
      return null;
    const { showtime, seat } = seatShowtime;
    const { movie, room } = showtime;
    if (!movie || !room) return null;

    return {
      seatShowtimeId: seatShowtime.id,
      showtimeId: showtime.id,
      movieId: showtime.movieId,
      movieTitle: movie.movieName,
      roomId: room.id,
      roomName: room.roomName,
      seatId: seat.id,
      rowPosition: seat.rowPosition,
      columnPosition: seat.columnPosition,
      price: showtime.basePrice,
      startTime: showtime.startTime,
      endTime: showtime.endTime,
      branchId: room.branchId,
      branchName: room.branch?.branchName ?? '',
      branchAddress: room.branch?.address,
    };
  }
}
