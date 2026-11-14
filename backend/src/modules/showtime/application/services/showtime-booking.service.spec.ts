import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

    it('trả về null khi thiếu movie hoặc room, và fallback branchName rỗng khi thiếu branch', async () => {
      mockPrisma.seatShowtime.findUnique.mockResolvedValue({
        id: 'sst-no-movie',
        showtime: { movie: null, room: { id: 'r-1' } },
        seat: { id: 's-1' },
      });
      await expect(service.getSeatShowtimeDetail('sst-no-movie')).resolves.toBeNull();

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 3600000);
      mockPrisma.seatShowtime.findUnique.mockResolvedValue({
        id: 'sst-no-branch',
        showtime: {
          id: 'st-1',
          movieId: 'm-1',
          startTime,
          endTime,
          basePrice: 60000,
          movie: { id: 'm-1', movieName: 'Phim' },
          room: { id: 'r-1', roomName: 'R1', branchId: 'b-1', branch: null },
        },
        seat: { id: 's-1', rowPosition: 'A', columnPosition: 1 },
      });

      const res = await service.getSeatShowtimeDetail('sst-no-branch');
      expect(res?.branchName).toBe('');
    });
  });

  describe('additional reserveSeats, releaseSeats, confirmSeats & getSeatBookingDetails edges', () => {
    it('reserveSeats ném ConflictException khi danh sách rỗng, thiếu ghế hoặc khác suất chiếu', async () => {
      await expect(service.reserveSeats([])).rejects.toThrow(
        new ConflictException(SEAT_BOOKING_MESSAGES.DUPLICATED_SEATS),
      );

      mockPrisma.seatShowtime.findMany.mockResolvedValueOnce([]);
      await expect(service.reserveSeats(['ss-1'])).rejects.toThrow(
        new ConflictException(SEAT_BOOKING_MESSAGES.SEATS_UNAVAILABLE),
      );

      mockPrisma.seatShowtime.findMany.mockResolvedValueOnce([
        { id: 'ss-1', showtimeId: 'st-1', seatStatus: SeatShowtimeStatus.EMPTY },
        { id: 'ss-2', showtimeId: 'st-2', seatStatus: SeatShowtimeStatus.EMPTY },
      ]);
      await expect(service.reserveSeats(['ss-1', 'ss-2'])).rejects.toThrow(
        new ConflictException(SEAT_BOOKING_MESSAGES.SEATS_UNAVAILABLE),
      );
    });

    it('reserveSeats không rollback khi ghế đầu tiên thất bại', async () => {
      mockPrisma.seatShowtime.findMany.mockResolvedValue([
        {
          id: 'ss-1',
          showtimeId: 'st-1',
          seatStatus: SeatShowtimeStatus.EMPTY,
          showtime: { startTime: new Date(Date.now() + 600000) },
        },
      ]);
      mockPrisma.seatShowtime.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.reserveSeats(['ss-1'])).rejects.toThrow(
        new ConflictException(SEAT_BOOKING_MESSAGES.SEAT_NO_LONGER_AVAILABLE),
      );
      expect(mockPrisma.seatShowtime.updateMany).toHaveBeenCalledTimes(1);
    });

    it('releaseSeats([]) và confirmSeats([]) trả về 0, confirmSeats dùng prismaTx khi truyền vào', async () => {
      await expect(service.releaseSeats([])).resolves.toBe(0);
      await expect(service.confirmSeats([])).resolves.toBe(0);

      const tx = {
        seatShowtime: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      await expect(service.confirmSeats(['ss-1'], tx as any)).resolves.toBe(1);
      expect(tx.seatShowtime.updateMany).toHaveBeenCalled();
    });

    it('getSeatBookingDetails ném NotFoundException khi không đủ seatShowtime hoặc thiếu tham chiếu', async () => {
      mockPrisma.seatShowtime.findMany.mockResolvedValueOnce([]);
      await expect(service.getSeatBookingDetails(['ss-1'])).rejects.toThrow(
        new NotFoundException('Seat showtime not found'),
      );

      mockPrisma.seatShowtime.findMany.mockResolvedValueOnce([
        {
          id: 'ss-1',
          showtimeId: 'st-1',
          seatId: 's-1',
          seatStatus: SeatShowtimeStatus.EMPTY,
          seat: null,
          showtime: { room: { id: 'r-1' }, movie: { id: 'm-1' } },
        },
      ]);
      await expect(service.getSeatBookingDetails(['ss-1'])).rejects.toThrow(
        new NotFoundException('Seat showtime reference not found'),
      );
    });
  });
});
