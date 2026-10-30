import {
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SeatStatus, SeatShowtimeStatus } from '@prisma/client';
import { SHOWTIME_SCHEDULE_MESSAGES } from '../../domain/constants/showtime-schedule.constants';
import { ScheduleShowtimeInputDto } from '../dto/req.dto';
import { ShowtimeScheduleService } from './showtime-schedule.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const ST_A_START = new Date('2026-10-25T02:30:00Z');
const ST_A_END = new Date('2026-10-25T05:16:00Z');

const input = (
  o: Partial<ScheduleShowtimeInputDto> = {},
): ScheduleShowtimeInputDto => ({
  movieId: 'm-1',
  roomId: 'r-1',
  startTime: ST_A_START,
  endTime: ST_A_END,
  basePrice: 75000,
  seatPriceSelections: [{ seatType: 'VIP', ruleId: 'a1', multiplier: 1.5 }],
  dayPriceSelections: [{ dayType: 'WEEKEND', ruleId: null, multiplier: 1 }],
  ...o,
});

const showtimeDoc = (o: Record<string, unknown> = {}) => ({
  id: 'st-1',
  movieId: 'm-1',
  roomId: 'r-1',
  startTime: ST_A_START,
  endTime: ST_A_END,
  basePrice: 75000,
  seatPriceSelections: [],
  dayPriceSelections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...o,
});

describe('ShowtimeScheduleService', () => {
  let service: ShowtimeScheduleService;
  let mockPrisma: any;

  const expectHttp = async (
    promise: Promise<unknown>,
    type: new (...args: never[]) => HttpException,
    message?: string,
    code?: string,
  ) => {
    let caught: unknown;
    try {
      await promise;
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(type);
    const response = (caught as HttpException).getResponse();
    if (message) {
      expect(
        typeof response === 'string'
          ? response
          : (response as { message: string }).message,
      ).toBe(message);
    }
    if (code) {
      expect((response as { code: string }).code).toBe(code);
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    mockPrisma = {
      showtime: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(showtimeDoc()),
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({
            ...showtimeDoc(),
            ...args.data,
            id: 'st-new',
          }),
        ),
        update: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({
            ...showtimeDoc(),
            ...args.data,
          }),
        ),
        delete: jest.fn().mockResolvedValue({ id: 'st-1' }),
      },
      seatShowtime: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      seat: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', status: SeatStatus.AVAILABLE },
          { id: 's2', status: SeatStatus.AVAILABLE },
          { id: 's3', status: SeatStatus.AVAILABLE },
        ]),
      },
    };

    service = new ShowtimeScheduleService(
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('hasRoomConflict', () => {
    it('dựng filter chồng lấn [start, end)', async () => {
      mockPrisma.showtime.findFirst.mockResolvedValue({ id: 'x' });
      await expect(
        service.hasRoomConflict('r-1', ST_A_START, ST_A_END),
      ).resolves.toBe(true);
      expect(mockPrisma.showtime.findFirst).toHaveBeenCalledWith({
        where: {
          roomId: 'r-1',
          startTime: { lt: ST_A_END },
          endTime: { gt: ST_A_START },
        },
        select: { id: true },
      });
    });

    it('thêm not khi loại trừ chính nó và trả false khi không trùng', async () => {
      await expect(
        service.hasRoomConflict('r-1', ST_A_START, ST_A_END, 'st-1'),
      ).resolves.toBe(false);
      expect(mockPrisma.showtime.findFirst).toHaveBeenCalledWith({
        where: {
          roomId: 'r-1',
          startTime: { lt: ST_A_END },
          endTime: { gt: ST_A_START },
          id: { not: 'st-1' },
        },
        select: { id: true },
      });
    });
  });

  describe('hasSoldTickets / findSoldShowtimeIds', () => {
    it('hasSoldTickets true/false với filter seatStatus != EMPTY', async () => {
      await expect(service.hasSoldTickets('st-1')).resolves.toBe(false);
      expect(mockPrisma.seatShowtime.findFirst).toHaveBeenCalledWith({
        where: {
          showtimeId: 'st-1',
          seatStatus: { not: SeatShowtimeStatus.EMPTY },
        },
        select: { id: true },
      });
      mockPrisma.seatShowtime.findFirst.mockResolvedValue({ id: 'y' });
      await expect(service.hasSoldTickets('st-1')).resolves.toBe(true);
    });

    it('findSoldShowtimeIds trả tập id duy nhất bằng 1 truy vấn', async () => {
      mockPrisma.seatShowtime.findMany.mockResolvedValue([
        { showtimeId: 'st-1' },
        { showtimeId: 'st-1' },
      ]);
      const result = await service.findSoldShowtimeIds(['st-1', 'st-2']);
      expect(result).toEqual(new Set(['st-1']));
      expect(mockPrisma.seatShowtime.findMany).toHaveBeenCalledTimes(1);
    });

    it('findSoldShowtimeIds với danh sách rỗng không truy vấn', async () => {
      await expect(service.findSoldShowtimeIds([])).resolves.toEqual(new Set());
      expect(mockPrisma.seatShowtime.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createShowtime', () => {
    it('tạo suất và sinh ghế EMPTY cho mọi ghế AVAILABLE', async () => {
      const result = await service.createShowtime(input());
      expect(mockPrisma.showtime.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.seat.findMany).toHaveBeenCalledWith({
        where: {
          roomId: 'r-1',
          status: SeatStatus.AVAILABLE,
        },
        select: { id: true },
      });
      const [args] = mockPrisma.seatShowtime.createMany.mock.calls[0] as [
        { data: { showtimeId: string; seatId: string; seatStatus: string }[] },
      ];
      expect(args.data).toHaveLength(3);
      expect(args.data.every((r) => r.seatStatus === 'EMPTY')).toBe(true);
      expect(args.data[0].showtimeId).toBe('st-new');
      expect(result.showtimeId).toBe('st-new');
      expect(result.seatPriceSelections).toEqual([
        { seatType: 'VIP', ruleId: 'a1', multiplier: 1.5 },
      ]);
    });

    it('phòng không có ghế vẫn tạo suất', async () => {
      mockPrisma.seat.findMany.mockResolvedValue([]);
      await expect(service.createShowtime(input())).resolves.toBeDefined();
      expect(mockPrisma.seatShowtime.createMany).not.toHaveBeenCalled();
    });

    it('trùng phòng -> 409 MSG03 và không create', async () => {
      mockPrisma.showtime.findFirst.mockResolvedValue({ id: 'x' });
      await expectHttp(
        service.createShowtime(input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG03,
        'ROOM_CONFLICT',
      );
      expect(mockPrisma.showtime.create).not.toHaveBeenCalled();
    });

    it('endTime <= startTime -> 400', async () => {
      await expectHttp(
        service.createShowtime(input({ endTime: ST_A_START })),
        BadRequestException,
      );
      expect(mockPrisma.showtime.create).not.toHaveBeenCalled();
    });

    it('createMany lỗi -> bù trừ deleteMany + delete và 500', async () => {
      mockPrisma.seatShowtime.createMany.mockRejectedValue(
        new Error('prisma down'),
      );
      await expectHttp(
        service.createShowtime(input()),
        InternalServerErrorException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG_SCHEDULE_FAILED,
      );
      expect(mockPrisma.seatShowtime.deleteMany).toHaveBeenCalledWith({
        where: { showtimeId: 'st-new' },
      });
      expect(mockPrisma.showtime.delete).toHaveBeenCalledWith({
        where: { id: 'st-new' },
      });
    });

    it('create lỗi -> 500, không bù trừ', async () => {
      mockPrisma.showtime.create.mockRejectedValue(new Error('prisma down'));
      await expectHttp(
        service.createShowtime(input()),
        InternalServerErrorException,
      );
      expect(mockPrisma.showtime.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateShowtime', () => {
    it('không tồn tại -> 404', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(null);
      await expectHttp(
        service.updateShowtime('st-x', input()),
        NotFoundException,
      );
    });

    it('đã bán vé -> 409 MSG04 và không ghi', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(showtimeDoc());
      mockPrisma.seatShowtime.findFirst.mockResolvedValue({ id: 'y' });
      await expectHttp(
        service.updateShowtime('st-1', input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG04,
        'SHOWTIME_SOLD',
      );
      expect(mockPrisma.showtime.update).not.toHaveBeenCalled();
    });

    it('trùng phòng -> 409 MSG03, loại trừ chính nó', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(showtimeDoc());
      mockPrisma.showtime.findFirst.mockResolvedValue({ id: 'x' });
      await expectHttp(
        service.updateShowtime('st-1', input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG03,
        'ROOM_CONFLICT',
      );
      expect(mockPrisma.showtime.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: { not: 'st-1' } }),
        select: { id: true },
      });
      expect(mockPrisma.showtime.update).not.toHaveBeenCalled();
    });

    it('đổi phòng -> xóa và sinh lại ghế', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(showtimeDoc());
      await service.updateShowtime('st-1', input({ roomId: 'r-2' }));
      expect(mockPrisma.showtime.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: expect.objectContaining({ roomId: 'r-2' }),
      });
      expect(mockPrisma.seatShowtime.deleteMany).toHaveBeenCalledWith({
        where: { showtimeId: 'st-1' },
      });
      expect(mockPrisma.seatShowtime.createMany).toHaveBeenCalledTimes(1);
    });

    it('giữ phòng -> không đụng ghế, cập nhật snapshot', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(showtimeDoc());
      const result = await service.updateShowtime('st-1', input());
      expect(mockPrisma.seatShowtime.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.seatShowtime.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.showtime.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: expect.objectContaining({
          seatPriceSelections: input().seatPriceSelections,
        }),
      });
      expect(result.showtimeId).toBe('st-1');
    });

    it('lỗi DB -> 500', async () => {
      mockPrisma.showtime.findUnique.mockRejectedValue(new Error('prisma down'));
      await expectHttp(
        service.updateShowtime('st-1', input()),
        InternalServerErrorException,
      );
    });
  });

  describe('deleteShowtime', () => {
    it('không tồn tại -> 404', async () => {
      mockPrisma.showtime.findUnique.mockResolvedValue(null);
      await expectHttp(service.deleteShowtime('st-x'), NotFoundException);
    });

    it('đã bán vé -> 409 MSG05, không xóa gì', async () => {
      mockPrisma.seatShowtime.findFirst.mockResolvedValue({ id: 'y' });
      await expectHttp(
        service.deleteShowtime('st-1'),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG05,
        'SHOWTIME_SOLD',
      );
      expect(mockPrisma.seatShowtime.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.showtime.delete).not.toHaveBeenCalled();
    });

    it('thành công -> xóa ghế rồi suất và trả bản ghi đã xóa', async () => {
      const order: string[] = [];
      mockPrisma.seatShowtime.deleteMany.mockImplementation(() => {
        order.push('seats');
        return Promise.resolve({ count: 3 });
      });
      mockPrisma.showtime.delete.mockImplementation(() => {
        order.push('showtime');
        return Promise.resolve(showtimeDoc());
      });
      const result = await service.deleteShowtime('st-1');
      expect(order).toEqual(['seats', 'showtime']);
      expect(result.showtimeId).toBe('st-1');
    });

    it('lỗi DB -> 500', async () => {
      mockPrisma.showtime.delete.mockRejectedValue(new Error('prisma down'));
      await expectHttp(
        service.deleteShowtime('st-1'),
        InternalServerErrorException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG_SCHEDULE_FAILED,
      );
    });
  });
});
