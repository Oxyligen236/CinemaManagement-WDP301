import { NotFoundException } from '@nestjs/common';
import { SeatShowtimeStatus, SeatType } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SeatShowtimeQueryService } from './seat-showtime-query.service';

describe('SeatShowtimeQueryService', () => {
  let service: SeatShowtimeQueryService;
  let mockPrisma: {
    showtime: { findUnique: jest.Mock };
    seatShowtime: { findMany: jest.Mock };
  };

  beforeEach(() => {
    mockPrisma = {
      showtime: { findUnique: jest.fn() },
      seatShowtime: { findMany: jest.fn() },
    };
    service = new SeatShowtimeQueryService(
      mockPrisma as unknown as PrismaService,
    );
  });

  it('throws NotFoundException when showtime does not exist', async () => {
    mockPrisma.showtime.findUnique.mockResolvedValue(null);

    await expect(service.getShowtimeSeats('st-missing')).rejects.toThrow(
      new NotFoundException('Showtime not found'),
    );
    expect(mockPrisma.seatShowtime.findMany).not.toHaveBeenCalled();
  });

  it('maps seatShowtimes, filters out null seats, and sorts by row then column', async () => {
    mockPrisma.showtime.findUnique.mockResolvedValue({ id: 'st-1' });
    mockPrisma.seatShowtime.findMany.mockResolvedValue([
      {
        id: 'ss-3',
        showtimeId: 'st-1',
        seatId: 's-3',
        seatStatus: SeatShowtimeStatus.BOOKED,
        seat: {
          id: 's-3',
          rowPosition: 'B',
          columnPosition: 1,
          seatType: SeatType.VIP,
        },
      },
      {
        id: 'ss-orphan',
        showtimeId: 'st-1',
        seatId: 's-orphan',
        seatStatus: SeatShowtimeStatus.EMPTY,
        seat: null,
      },
      {
        id: 'ss-2',
        showtimeId: 'st-1',
        seatId: 's-2',
        seatStatus: SeatShowtimeStatus.RESERVED,
        seat: {
          id: 's-2',
          rowPosition: 'A',
          columnPosition: 2,
          seatType: SeatType.STANDARD,
        },
      },
      {
        id: 'ss-1',
        showtimeId: 'st-1',
        seatId: 's-1',
        seatStatus: SeatShowtimeStatus.EMPTY,
        seat: {
          id: 's-1',
          rowPosition: 'A',
          columnPosition: 1,
          seatType: SeatType.STANDARD,
        },
      },
    ]);

    const result = await service.getShowtimeSeats('st-1');

    expect(result).toHaveLength(3);
    expect(result.map((s) => `${s.rowPosition}${s.columnPosition}`)).toEqual([
      'A1',
      'A2',
      'B1',
    ]);
    expect(result[2]).toMatchObject({
      seatShowtimeId: 'ss-3',
      seatId: 's-3',
      seatType: SeatType.VIP,
      seatStatus: SeatShowtimeStatus.BOOKED,
    });
  });
});
