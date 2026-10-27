import {
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Seat } from '../../../room/domain/schemas/seat.schema';
import { SHOWTIME_SCHEDULE_MESSAGES } from '../../domain/constants/showtime-schedule.constants';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import { SeatShowtime } from '../../domain/schemas/seat-showtime.schema';
import { Showtime } from '../../domain/schemas/showtime.schema';
import { ScheduleShowtimeInputDto } from '../dto/req.dto';
import { ShowtimeScheduleService } from './showtime-schedule.service';

const ST_A_START = new Date('2026-10-25T02:30:00Z');
const ST_A_END = new Date('2026-10-25T05:16:00Z');

const chain = (result: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const rejectChain = () => ({
  sort: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockRejectedValue(new Error('mongo down')),
});

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

const showtimeDoc = (o: Record<string, unknown> = {}) => {
  const doc: Record<string, unknown> = {
    showtimeId: 'st-1',
    movieId: 'm-1',
    roomId: 'r-1',
    startTime: ST_A_START,
    endTime: ST_A_END,
    basePrice: 75000,
    seatPriceSelections: [],
    dayPriceSelections: [],
    ...o,
  };
  doc.save = jest.fn().mockResolvedValue(doc);
  return doc;
};

describe('ShowtimeScheduleService', () => {
  let service: ShowtimeScheduleService;
  const showtimeModel = {
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  };
  const seatShowtimeModel = {
    exists: jest.fn(),
    find: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const seatModel = { find: jest.fn() };

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

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    showtimeModel.findOne.mockImplementation(() => chain(showtimeDoc()));
    showtimeModel.exists.mockImplementation(() => chain(null));
    showtimeModel.create.mockImplementation((d: Record<string, unknown>) =>
      Promise.resolve({ ...showtimeDoc(), ...d, showtimeId: 'st-new' }),
    );
    showtimeModel.deleteOne.mockImplementation(() =>
      chain({ deletedCount: 1 }),
    );
    seatShowtimeModel.exists.mockImplementation(() => chain(null));
    seatShowtimeModel.find.mockImplementation(() => chain([]));
    seatShowtimeModel.insertMany.mockImplementation((a: unknown[]) =>
      Promise.resolve(a),
    );
    seatShowtimeModel.deleteMany.mockImplementation(() =>
      chain({ deletedCount: 3 }),
    );
    seatModel.find.mockImplementation(() =>
      chain([{ seatId: 's1' }, { seatId: 's2' }, { seatId: 's3' }]),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShowtimeScheduleService,
        { provide: getModelToken(Showtime.name), useValue: showtimeModel },
        {
          provide: getModelToken(SeatShowtime.name),
          useValue: seatShowtimeModel,
        },
        { provide: getModelToken(Seat.name), useValue: seatModel },
      ],
    }).compile();
    service = moduleRef.get(ShowtimeScheduleService);
  });

  describe('hasRoomConflict', () => {
    it('dựng filter chồng lấn [start, end)', async () => {
      showtimeModel.exists.mockImplementation(() => chain({ _id: 'x' }));
      await expect(
        service.hasRoomConflict('r-1', ST_A_START, ST_A_END),
      ).resolves.toBe(true);
      expect(showtimeModel.exists).toHaveBeenCalledWith({
        roomId: 'r-1',
        startTime: { $lt: ST_A_END },
        endTime: { $gt: ST_A_START },
      });
    });

    it('thêm $ne khi loại trừ chính nó và trả false khi không trùng', async () => {
      await expect(
        service.hasRoomConflict('r-1', ST_A_START, ST_A_END, 'st-1'),
      ).resolves.toBe(false);
      expect(showtimeModel.exists).toHaveBeenCalledWith({
        roomId: 'r-1',
        startTime: { $lt: ST_A_END },
        endTime: { $gt: ST_A_START },
        showtimeId: { $ne: 'st-1' },
      });
    });
  });

  describe('hasSoldTickets / findSoldShowtimeIds', () => {
    it('hasSoldTickets true/false với filter seatStatus != EMPTY', async () => {
      await expect(service.hasSoldTickets('st-1')).resolves.toBe(false);
      expect(seatShowtimeModel.exists).toHaveBeenCalledWith({
        showtimeId: 'st-1',
        seatStatus: { $ne: SeatShowtimeStatus.EMPTY },
      });
      seatShowtimeModel.exists.mockImplementation(() => chain({ _id: 'y' }));
      await expect(service.hasSoldTickets('st-1')).resolves.toBe(true);
    });

    it('findSoldShowtimeIds trả tập id duy nhất bằng 1 truy vấn', async () => {
      seatShowtimeModel.find.mockImplementation(() =>
        chain([{ showtimeId: 'st-1' }, { showtimeId: 'st-1' }]),
      );
      const result = await service.findSoldShowtimeIds(['st-1', 'st-2']);
      expect(result).toEqual(new Set(['st-1']));
      expect(seatShowtimeModel.find).toHaveBeenCalledTimes(1);
    });

    it('findSoldShowtimeIds với danh sách rỗng không truy vấn', async () => {
      await expect(service.findSoldShowtimeIds([])).resolves.toEqual(new Set());
      expect(seatShowtimeModel.find).not.toHaveBeenCalled();
    });
  });

  describe('createShowtime', () => {
    it('tạo suất và sinh ghế EMPTY cho mọi ghế AVAILABLE', async () => {
      const result = await service.createShowtime(input());
      expect(showtimeModel.create).toHaveBeenCalledTimes(1);
      expect(seatModel.find).toHaveBeenCalledWith({
        roomId: 'r-1',
        status: 'AVAILABLE',
      });
      const [rows] = seatShowtimeModel.insertMany.mock.calls[0] as [
        { showtimeId: string; seatStatus: string }[],
      ];
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.seatStatus === 'EMPTY')).toBe(true);
      expect(rows[0].showtimeId).toBe('st-new');
      expect(result.showtimeId).toBe('st-new');
      expect(result.seatPriceSelections).toEqual([
        { seatType: 'VIP', ruleId: 'a1', multiplier: 1.5 },
      ]);
    });

    it('phòng không có ghế vẫn tạo suất', async () => {
      seatModel.find.mockImplementation(() => chain([]));
      await expect(service.createShowtime(input())).resolves.toBeDefined();
      expect(seatShowtimeModel.insertMany).not.toHaveBeenCalled();
    });

    it('trùng phòng -> 409 MSG03 và không create', async () => {
      showtimeModel.exists.mockImplementation(() => chain({ _id: 'x' }));
      await expectHttp(
        service.createShowtime(input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG03,
        'ROOM_CONFLICT',
      );
      expect(showtimeModel.create).not.toHaveBeenCalled();
    });

    it('endTime <= startTime -> 400', async () => {
      await expectHttp(
        service.createShowtime(input({ endTime: ST_A_START })),
        BadRequestException,
      );
      expect(showtimeModel.create).not.toHaveBeenCalled();
    });

    it('insertMany lỗi -> bù trừ deleteMany + deleteOne và 500', async () => {
      seatShowtimeModel.insertMany.mockRejectedValue(new Error('mongo down'));
      await expectHttp(
        service.createShowtime(input()),
        InternalServerErrorException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG_SCHEDULE_FAILED,
      );
      expect(seatShowtimeModel.deleteMany).toHaveBeenCalledWith({
        showtimeId: 'st-new',
      });
      expect(showtimeModel.deleteOne).toHaveBeenCalledWith({
        showtimeId: 'st-new',
      });
    });

    it('create lỗi -> 500, không bù trừ', async () => {
      showtimeModel.create.mockRejectedValue(new Error('mongo down'));
      await expectHttp(
        service.createShowtime(input()),
        InternalServerErrorException,
      );
      expect(showtimeModel.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('updateShowtime', () => {
    it('không tồn tại -> 404', async () => {
      showtimeModel.findOne.mockImplementation(() => chain(null));
      await expectHttp(
        service.updateShowtime('st-x', input()),
        NotFoundException,
      );
    });

    it('đã bán vé -> 409 MSG04 và không ghi', async () => {
      const doc = showtimeDoc();
      showtimeModel.findOne.mockImplementation(() => chain(doc));
      seatShowtimeModel.exists.mockImplementation(() => chain({ _id: 'y' }));
      await expectHttp(
        service.updateShowtime('st-1', input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG04,
        'SHOWTIME_SOLD',
      );
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('trùng phòng -> 409 MSG03, loại trừ chính nó', async () => {
      const doc = showtimeDoc();
      showtimeModel.findOne.mockImplementation(() => chain(doc));
      showtimeModel.exists.mockImplementation(() => chain({ _id: 'x' }));
      await expectHttp(
        service.updateShowtime('st-1', input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG03,
        'ROOM_CONFLICT',
      );
      expect(showtimeModel.exists).toHaveBeenCalledWith(
        expect.objectContaining({ showtimeId: { $ne: 'st-1' } }),
      );
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('đổi phòng -> xóa và sinh lại ghế', async () => {
      const doc = showtimeDoc();
      showtimeModel.findOne.mockImplementation(() => chain(doc));
      await service.updateShowtime('st-1', input({ roomId: 'r-2' }));
      expect(doc.roomId).toBe('r-2');
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(seatShowtimeModel.deleteMany).toHaveBeenCalledWith({
        showtimeId: 'st-1',
      });
      expect(seatShowtimeModel.insertMany).toHaveBeenCalledTimes(1);
    });

    it('giữ phòng -> không đụng ghế, cập nhật snapshot', async () => {
      const doc = showtimeDoc();
      showtimeModel.findOne.mockImplementation(() => chain(doc));
      const result = await service.updateShowtime('st-1', input());
      expect(seatShowtimeModel.deleteMany).not.toHaveBeenCalled();
      expect(seatShowtimeModel.insertMany).not.toHaveBeenCalled();
      expect(doc.seatPriceSelections).toEqual(input().seatPriceSelections);
      expect(result.showtimeId).toBe('st-1');
    });

    it('lỗi DB -> 500', async () => {
      showtimeModel.findOne.mockImplementation(() => rejectChain());
      await expectHttp(
        service.updateShowtime('st-1', input()),
        InternalServerErrorException,
      );
    });
  });

  describe('deleteShowtime', () => {
    it('không tồn tại -> 404', async () => {
      showtimeModel.findOne.mockImplementation(() => chain(null));
      await expectHttp(service.deleteShowtime('st-x'), NotFoundException);
    });

    it('đã bán vé -> 409 MSG05, không xóa gì', async () => {
      seatShowtimeModel.exists.mockImplementation(() => chain({ _id: 'y' }));
      await expectHttp(
        service.deleteShowtime('st-1'),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG05,
        'SHOWTIME_SOLD',
      );
      expect(seatShowtimeModel.deleteMany).not.toHaveBeenCalled();
      expect(showtimeModel.deleteOne).not.toHaveBeenCalled();
    });

    it('thành công -> xóa ghế rồi suất và trả bản ghi đã xóa', async () => {
      const order: string[] = [];
      seatShowtimeModel.deleteMany.mockImplementation(() => {
        order.push('seats');
        return chain({});
      });
      showtimeModel.deleteOne.mockImplementation(() => {
        order.push('showtime');
        return chain({});
      });
      const result = await service.deleteShowtime('st-1');
      expect(order).toEqual(['seats', 'showtime']);
      expect(result.showtimeId).toBe('st-1');
    });

    it('lỗi DB -> 500', async () => {
      showtimeModel.deleteOne.mockImplementation(() => rejectChain());
      await expectHttp(
        service.deleteShowtime('st-1'),
        InternalServerErrorException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG_SCHEDULE_FAILED,
      );
    });
  });
});
