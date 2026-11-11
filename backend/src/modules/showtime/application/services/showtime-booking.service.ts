import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { Prisma, SeatShowtimeStatus } from '@prisma/client';
import {
  SeatBookingDetail,
  SeatBookingDetailDto,
  SeatShowtimeDetailDto,
} from '../dto/res.dto';
import { SEAT_BOOKING_MESSAGES } from '../../domain/showtime.rules';

@Injectable()
export class ShowtimeBookingService {
  constructor(private readonly prisma: PrismaService) {}

  async reserveSeats(seatShowtimeIds: string[]): Promise<SeatBookingDetail[]> {
    if (
      !seatShowtimeIds.length ||
      new Set(seatShowtimeIds).size !== seatShowtimeIds.length
    ) {
      throw new ConflictException(SEAT_BOOKING_MESSAGES.DUPLICATED_SEATS);
    }

    const seats = await this.prisma.seatShowtime.findMany({
      where: { id: { in: seatShowtimeIds } },
      include: {
        showtime: {
          select: {
            startTime: true,
          },
        },
      },
    });

    if (
      seats.length !== seatShowtimeIds.length ||
      new Set(seats.map((seat) => seat.showtimeId)).size !== 1
    ) {
      throw new ConflictException(SEAT_BOOKING_MESSAGES.SEATS_UNAVAILABLE);
    }

    if (
      seats[0]?.showtime?.startTime &&
      new Date(seats[0].showtime.startTime).getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        SEAT_BOOKING_MESSAGES.PAST_SHOWTIME_BOOKING,
      );
    }

    if (seats.some((seat) => seat.seatStatus !== SeatShowtimeStatus.EMPTY)) {
      throw new ConflictException(SEAT_BOOKING_MESSAGES.SEATS_UNAVAILABLE);
    }

    const showtimeId = seats[0].showtimeId;
    const reserved: string[] = [];

    try {
      for (const id of seatShowtimeIds) {
        const updateResult = await this.prisma.seatShowtime.updateMany({
          where: {
            id,
            showtimeId,
            seatStatus: SeatShowtimeStatus.EMPTY,
          },
          data: { seatStatus: SeatShowtimeStatus.RESERVED },
        });

        if (updateResult.count !== 1) {
          throw new ConflictException(
            SEAT_BOOKING_MESSAGES.SEAT_NO_LONGER_AVAILABLE,
          );
        }
        reserved.push(id);
      }
      return await this.getSeatBookingDetails(seatShowtimeIds);
    } catch (error) {
      if (reserved.length) {
        await this.prisma.seatShowtime.updateMany({
          where: {
            id: { in: reserved },
            showtimeId,
            seatStatus: SeatShowtimeStatus.RESERVED,
          },
          data: { seatStatus: SeatShowtimeStatus.EMPTY },
        });
      }
      throw error;
    }
  }

  async releaseSeats(seatShowtimeIds: string[]): Promise<number> {
    if (!seatShowtimeIds.length) return 0;
    const result = await this.prisma.seatShowtime.updateMany({
      where: {
        id: { in: seatShowtimeIds },
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      data: { seatStatus: SeatShowtimeStatus.EMPTY },
    });
    return result.count;
  }

  async confirmSeats(
    seatShowtimeIds: string[],
    prismaTx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (!seatShowtimeIds.length) return 0;
    const client = prismaTx ?? this.prisma;
    const result = await client.seatShowtime.updateMany({
      where: {
        id: { in: seatShowtimeIds },
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      data: { seatStatus: SeatShowtimeStatus.BOOKED },
    });
    if (result.count !== seatShowtimeIds.length) {
      throw new ConflictException(
        'Một số ghế không ở trạng thái giữ chỗ để có thể hoàn tất đặt vé',
      );
    }
    return result.count;
  }

  async getSeatBookingDetails(
    seatShowtimeIds: string[],
  ): Promise<SeatBookingDetail[]> {
    const seatShowtimes = await this.prisma.seatShowtime.findMany({
      where: { id: { in: seatShowtimeIds } },
      include: {
        seat: true,
        showtime: {
          include: {
            room: true,
            movie: true,
          },
        },
      },
    });

    if (seatShowtimes.length !== new Set(seatShowtimeIds).size) {
      throw new NotFoundException('Seat showtime not found');
    }

    return seatShowtimes.map((item) => {
      const showtime = item.showtime;
      const physicalSeat = item.seat;
      const room = showtime?.room;
      const movie = showtime?.movie;

      if (!showtime || !physicalSeat || !room || !movie) {
        throw new NotFoundException('Seat showtime reference not found');
      }

      return SeatBookingDetailDto.of({
        seatShowtimeId: item.id,
        showtimeId: item.showtimeId,
        seatId: item.seatId,
        seatStatus: item.seatStatus,
        seatType: physicalSeat.seatType,
        rowPosition: physicalSeat.rowPosition,
        columnPosition: physicalSeat.columnPosition,
        roomId: room.id,
        roomName: room.roomName,
        branchId: room.branchId,
        movieId: movie.id,
        movieName: movie.movieName,
        movieTitle: movie.movieName,
        startTime: showtime.startTime,
        endTime: showtime.endTime,
        basePrice: showtime.basePrice,
      });
    });
  }

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

    return SeatShowtimeDetailDto.of({
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
    });
  }
}
