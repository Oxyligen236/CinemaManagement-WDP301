import { BadRequestException, ConflictException } from '@nestjs/common';
import { SeatShowtimeStatus } from '@prisma/client';
import { ShowtimeBookingService } from './showtime-booking.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SEAT_BOOKING_MESSAGES } from '../../domain/showtime.rules';

describe('ShowtimeBookingService', () => {
  let service: ShowtimeBookingService;
  let mockPrisma: {
    seatShowtime: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      seatShowtime: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    service = new ShowtimeBookingService(
      mockPrisma as unknown as PrismaService,
    );
  });

  it('reserves all EMPTY seats and returns details', async () => {
    const futureStartTime = new Date(Date.now() + 60 * 60 * 1000);
    mockPrisma.seatShowtime.findMany.mockResolvedValue([
      {
        id: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        seatStatus: SeatShowtimeStatus.EMPTY,
        showtime: { startTime: futureStartTime },
      },
    ]);
    jest.spyOn(service, 'getSeatBookingDetails').mockResolvedValue([]);

    await expect(service.reserveSeats(['ss1'])).resolves.toEqual([]);
    expect(mockPrisma.seatShowtime.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['ss1'] } },
      include: { showtime: { select: { startTime: true } } },
    });
    expect(mockPrisma.seatShowtime.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ss1',
        showtimeId: 'st1',
        seatStatus: SeatShowtimeStatus.EMPTY,
      },
      data: { seatStatus: SeatShowtimeStatus.RESERVED },
    });
  });

  it('throws BadRequestException when showtime startTime is in the past without updating seats', async () => {
    const pastStartTime = new Date(Date.now() - 60 * 1000);
    mockPrisma.seatShowtime.findMany.mockResolvedValue([
      {
        id: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        seatStatus: SeatShowtimeStatus.EMPTY,
        showtime: { startTime: pastStartTime },
      },
    ]);

    const promise = service.reserveSeats(['ss1']);
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow(
      SEAT_BOOKING_MESSAGES.PAST_SHOWTIME_BOOKING,
    );
    expect(mockPrisma.seatShowtime.updateMany).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when showtime startTime equals current time without updating seats', async () => {
    const now = Date.now();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    try {
      mockPrisma.seatShowtime.findMany.mockResolvedValue([
        {
          id: 'ss1',
          showtimeId: 'st1',
          seatId: 's1',
          seatStatus: SeatShowtimeStatus.EMPTY,
          showtime: { startTime: new Date(now) },
        },
      ]);

      const promise = service.reserveSeats(['ss1']);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        SEAT_BOOKING_MESSAGES.PAST_SHOWTIME_BOOKING,
      );
      expect(mockPrisma.seatShowtime.updateMany).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it.each([SeatShowtimeStatus.RESERVED, SeatShowtimeStatus.BOOKED])(
    'conflicts for %s without partial updates',
    async (status) => {
      const futureStartTime = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.seatShowtime.findMany.mockResolvedValue([
        {
          id: 'ss1',
          showtimeId: 'st1',
          seatId: 's1',
          seatStatus: SeatShowtimeStatus.EMPTY,
          showtime: { startTime: futureStartTime },
        },
        {
          id: 'ss2',
          showtimeId: 'st1',
          seatId: 's2',
          seatStatus: status,
          showtime: { startTime: futureStartTime },
        },
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
    const futureStartTime = new Date(Date.now() + 60 * 60 * 1000);
    mockPrisma.seatShowtime.findMany.mockResolvedValue([
      {
        id: 'ss1',
        showtimeId: 'st1',
        seatId: 's1',
        seatStatus: SeatShowtimeStatus.EMPTY,
        showtime: { startTime: futureStartTime },
      },
      {
        id: 'ss2',
        showtimeId: 'st1',
        seatId: 's2',
        seatStatus: SeatShowtimeStatus.EMPTY,
        showtime: { startTime: futureStartTime },
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

  describe('getSeatShowtimeDetail', () => {
    it('trả về null nếu không tìm thấy seatShowtime', async () => {
      mockPrisma.seatShowtime.findUnique.mockResolvedValue(null);

      const result = await service.getSeatShowtimeDetail('invalid-id');
      expect(result).toBeNull();
    });

    it('trả về null nếu không tìm thấy showtime hoặc seat', async () => {
      mockPrisma.seatShowtime.findUnique.mockResolvedValue({
        id: 'sst-1',
        showtime: null,
        seat: { id: 'seat-1' },
      });

      const result = await service.getSeatShowtimeDetail('sst-1');
      expect(result).toBeNull();
    });

    it('trả về đầy đủ SeatShowtimeDetailDto khi dữ liệu hợp lệ', async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 7200000);

      mockPrisma.seatShowtime.findUnique.mockResolvedValue({
        id: 'sst-1',
        showtime: {
          id: 'st-1',
          movieId: 'm-1',
          startTime,
          endTime,
          basePrice: 90000,
          movie: {
            id: 'm-1',
            movieName: 'Lật Mặt 7',
          },
          room: {
            id: 'r-1',
            roomName: 'Cinema 1',
            branchId: 'b-1',
            branch: {
              id: 'b-1',
              branchName: 'Chi nhánh Hà Đông',
              address: '123 Quang Trung, Hà Đông, Hà Nội',
            },
          },
        },
        seat: {
          id: 'seat-1',
          rowPosition: 'C',
          columnPosition: 5,
        },
      });

      const result = await service.getSeatShowtimeDetail('sst-1');

      expect(result).toEqual({
        seatShowtimeId: 'sst-1',
        showtimeId: 'st-1',
        movieId: 'm-1',
        movieTitle: 'Lật Mặt 7',
        roomId: 'r-1',
        roomName: 'Cinema 1',
        seatId: 'seat-1',
        rowPosition: 'C',
        columnPosition: 5,
        price: 90000,
        startTime,
        endTime,
        branchId: 'b-1',
        branchName: 'Chi nhánh Hà Đông',
        branchAddress: '123 Quang Trung, Hà Đông, Hà Nội',
      });
    });
  });
});
