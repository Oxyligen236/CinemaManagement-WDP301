import { ConflictException } from '@nestjs/common';
import { SeatShowtimeStatus } from '@prisma/client';
import { ShowtimeBookingService } from './showtime-booking.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('ShowtimeBookingService', () => {
  let service: ShowtimeBookingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      seatShowtime: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    service = new ShowtimeBookingService(mockPrisma as unknown as PrismaService);
  });

  it('reserves all EMPTY seats and returns details', async () => {
    mockPrisma.seatShowtime.findMany.mockResolvedValue([
      {
        id: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        seatStatus: SeatShowtimeStatus.EMPTY,
      },
    ]);
    jest.spyOn(service, 'getSeatBookingDetails').mockResolvedValue([]);

    await expect(service.reserveSeats(['ss1'])).resolves.toEqual([]);
    expect(mockPrisma.seatShowtime.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ss1',
        showtimeId: 'st1',
        seatStatus: SeatShowtimeStatus.EMPTY,
      },
      data: { seatStatus: SeatShowtimeStatus.RESERVED },
    });
  });

  it.each([SeatShowtimeStatus.RESERVED, SeatShowtimeStatus.BOOKED])(
    'conflicts for %s without partial updates',
    async (status) => {
      mockPrisma.seatShowtime.findMany.mockResolvedValue([
        {
          id: 'ss1',
          showtimeId: 'st1',
          seatId: 's1',
          seatStatus: SeatShowtimeStatus.EMPTY,
        },
        { id: 'ss2', showtimeId: 'st1', seatId: 's2', seatStatus: status },
      ]);

      await expect(service.reserveSeats(['ss1', 'ss2'])).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockPrisma.seatShowtime.updateMany).not.toHaveBeenCalled();
    },
  );

  it('conflicts on duplicate requested seatShowtimeIds', async () => {
    await expect(service.reserveSeats(['ss1', 'ss1'])).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rolls back earlier reservation when a competing update wins', async () => {
    mockPrisma.seatShowtime.findMany.mockResolvedValue([
      {
        id: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        seatStatus: SeatShowtimeStatus.EMPTY,
      },
      {
        id: 'ss2',
        showtimeId: 'st1',
        seatId: 's2',
        seatStatus: SeatShowtimeStatus.EMPTY,
      },
    ]);

    mockPrisma.seatShowtime.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(service.reserveSeats(['ss1', 'ss2'])).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockPrisma.seatShowtime.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['ss1'] },
        showtimeId: 'st1',
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      data: { seatStatus: SeatShowtimeStatus.EMPTY },
    });
  });

  it('releases RESERVED seats only', async () => {
    mockPrisma.seatShowtime.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.releaseSeats(['reserved', 'booked'])).resolves.toBe(1);
    expect(mockPrisma.seatShowtime.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['reserved', 'booked'] },
        seatStatus: SeatShowtimeStatus.RESERVED,
      },
      data: { seatStatus: SeatShowtimeStatus.EMPTY },
    });
  });

  describe('confirmSeats', () => {
    it('confirms seats by updating RESERVED to BOOKED', async () => {
      mockPrisma.seatShowtime.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.confirmSeats(['ss1', 'ss2'])).resolves.toBe(2);
      expect(mockPrisma.seatShowtime.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['ss1', 'ss2'] },
          seatStatus: SeatShowtimeStatus.RESERVED,
        },
        data: { seatStatus: SeatShowtimeStatus.BOOKED },
      });
    });

    it('throws ConflictException when modifiedCount does not match', async () => {
      mockPrisma.seatShowtime.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.confirmSeats(['ss1', 'ss2'])).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('joins seat, showtime, room, and movie details', async () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 7200000);

    mockPrisma.seatShowtime.findMany.mockResolvedValue([
      {
        id: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        seatStatus: SeatShowtimeStatus.BOOKED,
        seat: {
          id: 's1',
          seatType: 'STANDARD',
          rowPosition: 'A',
          columnPosition: 1,
        },
        showtime: {
          id: 'st1',
          startTime,
          endTime,
          basePrice: 50000,
          room: {
            id: 'r1',
            roomName: 'Room 1',
            branchId: 'b1',
          },
          movie: {
            id: 'm1',
            movieName: 'Film',
          },
        },
      },
    ]);

    await expect(service.getSeatBookingDetails(['ss1'])).resolves.toEqual([
      {
        seatShowtimeId: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        seatStatus: 'BOOKED',
        seatType: 'STANDARD',
        rowPosition: 'A',
        columnPosition: 1,
        branchId: 'b1',
        roomId: 'r1',
        roomName: 'Room 1',
        movieId: 'm1',
        movieName: 'Film',
        movieTitle: 'Film',
        startTime,
        endTime,
        basePrice: 50000,
      },
    ]);
  });
});
