import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SeatShowtimeStatus } from '@prisma/client';
import { SeatBookingDetail } from '../../contract/seat-booking-detail';
import { ConfirmShowtimeSeatsUsecase } from '../usecase/confirm-showtime-seats.usecase';
import { SEAT_BOOKING_MESSAGES } from '../../domain/showtime.rules';

@Injectable()
export class ShowtimeBookingService implements ConfirmShowtimeSeatsUsecase {
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
    });

    if (
      seats.length !== seatShowtimeIds.length ||
      seats.some((seat) => seat.seatStatus !== SeatShowtimeStatus.EMPTY) ||
      new Set(seats.map((seat) => seat.showtimeId)).size !== 1
    ) {
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
    prismaTx?: any,
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

      return {
        seatShowtimeId: item.id,
        showtimeId: item.showtimeId,
        seatId: item.seatId,
        seatStatus: item.seatStatus as any,
        seatType: physicalSeat.seatType as any,
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
      };
    });
  }
}
