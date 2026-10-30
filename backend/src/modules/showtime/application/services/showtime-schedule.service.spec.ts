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
import { Types } from 'mongoose';
import { Seat } from '../../../room/domain/schemas/seat.schema';
import { SHOWTIME_SCHEDULE_MESSAGES } from '../../domain/constants/showtime-schedule.constants';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import { SeatShowtime } from '../../domain/schemas/seat-showtime.schema';
import { Showtime } from '../../domain/schemas/showtime.schema';
import { ScheduleShowtimeInputDto } from '../dto/req.dto';
import { ShowtimeScheduleService } from './showtime-schedule.service';

const ST_ID = new Types.ObjectId().toString();
const ROOM_ID = new Types.ObjectId().toString();
const MOVIE_ID = new Types.ObjectId().toString();
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

const VIP_RULE_ID = new Types.ObjectId().toString();

const input = (
  o: Partial<ScheduleShowtimeInputDto> = {},
): ScheduleShowtimeInputDto => ({
  movieId: MOVIE_ID,
  roomId: ROOM_ID,
  startTime: ST_A_START,
  endTime: ST_A_END,
  basePrice: 75000,
  seatPriceSelections: [
    { seatType: 'VIP', ruleId: VIP_RULE_ID, multiplier: 1.5 },
  ],
  dayPriceSelections: [{ dayType: 'WEEKEND', ruleId: null, multiplier: 1 }],
  ...o,
});

const showtimeDoc = (o: Record<string, unknown> = {}) => {
  const doc: Record<string, unknown> = {
    _id: new Types.ObjectId(ST_ID),
    movieId: new Types.ObjectId(MOVIE_ID),
    roomId: new Types.ObjectId(ROOM_ID),
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
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
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
    showtimeModel.findById.mockImplementation(() => chain(showtimeDoc()));
    showtimeModel.findByIdAndDelete.mockImplementation(() =>
      chain({ _id: new Types.ObjectId(ST_ID) }),
    );
    showtimeModel.findOne.mockImplementation(() => chain(showtimeDoc()));
    showtimeModel.exists.mockImplementation(() => chain(null));
    showtimeModel.create.mockImplementation((d: Record<string, unknown>) =>
      Promise.resolve({ ...showtimeDoc(), ...d }),
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
      chain([
        { _id: new Types.ObjectId() },
        { _id: new Types.ObjectId() },
        { _id: new Types.ObjectId() },
      ]),
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
        service.hasRoomConflict(ROOM_ID, ST_A_START, ST_A_END),
      ).resolves.toBe(true);
      expect(showtimeModel.exists).toHaveBeenCalledWith({
        roomId: new Types.ObjectId(ROOM_ID),
        startTime: { $lt: ST_A_END },
        endTime: { $gt: ST_A_START },
      });
    });

    it('thêm $ne khi loại trừ chính nó và trả false khi không trùng', async () => {
      await expect(
        service.hasRoomConflict(ROOM_ID, ST_A_START, ST_A_END, ST_ID),
      ).resolves.toBe(false);
      expect(showtimeModel.exists).toHaveBeenCalledWith({
        roomId: new Types.ObjectId(ROOM_ID),
        startTime: { $lt: ST_A_END },
        endTime: { $gt: ST_A_START },
        _id: { $ne: new Types.ObjectId(ST_ID) },
      });
    });
  });

  describe('hasSoldTickets / findSoldShowtimeIds', () => {
    it('hasSoldTickets true/false với filter seatStatus != EMPTY', async () => {
      await expect(service.hasSoldTickets(ST_ID)).resolves.toBe(false);
      expect(seatShowtimeModel.exists).toHaveBeenCalledWith({
        showtimeId: new Types.ObjectId(ST_ID),
        seatStatus: { $ne: SeatShowtimeStatus.EMPTY },
      });
      seatShowtimeModel.exists.mockImplementation(() => chain({ _id: 'y' }));
      await expect(service.hasSoldTickets(ST_ID)).resolves.toBe(true);
    });

    it('findSoldShowtimeIds trả tập id duy nhất bằng 1 truy vấn', async () => {
      seatShowtimeModel.find.mockImplementation(() =>
        chain([{ showtimeId: ST_ID }, { showtimeId: ST_ID }]),
      );
      const result = await service.findSoldShowtimeIds([
        ST_ID,
        new Types.ObjectId().toString(),
      ]);
      expect(result).toEqual(new Set([ST_ID]));
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
        roomId: new Types.ObjectId(ROOM_ID),
        status: 'AVAILABLE',
      });
      const [rows] = seatShowtimeModel.insertMany.mock.calls[0] as [
        { showtimeId: Types.ObjectId; seatStatus: string }[],
      ];
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.seatStatus === 'EMPTY')).toBe(true);
      expect(rows[0].showtimeId.toString()).toBe(ST_ID);
      expect(result.showtimeId).toBe(ST_ID);
      expect(result.seatPriceSelections).toEqual([
        { seatType: 'VIP', ruleId: VIP_RULE_ID, multiplier: 1.5 },
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

    it('insertMany lỗi -> bù trừ deleteMany + findByIdAndDelete và 500', async () => {
      seatShowtimeModel.insertMany.mockRejectedValue(new Error('mongo down'));
      await expectHttp(
        service.createShowtime(input()),
        InternalServerErrorException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG_SCHEDULE_FAILED,
      );
      expect(seatShowtimeModel.deleteMany).toHaveBeenCalledWith({
        showtimeId: new Types.ObjectId(ST_ID),
      });
      expect(showtimeModel.findByIdAndDelete).toHaveBeenCalledWith(
        new Types.ObjectId(ST_ID),
      );
    });

    it('create lỗi -> 500, không bù trừ', async () => {
      showtimeModel.create.mockRejectedValue(new Error('mongo down'));
      await expectHttp(
        service.createShowtime(input()),
        InternalServerErrorException,
      );
      expect(showtimeModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  describe('updateShowtime', () => {
    it('không tồn tại -> 404', async () => {
      showtimeModel.findById.mockImplementation(() => chain(null));
      await expectHttp(
        service.updateShowtime(new Types.ObjectId().toString(), input()),
        NotFoundException,
      );
    });

    it('đã bán vé -> 409 MSG04 và không ghi', async () => {
      const doc = showtimeDoc();
      showtimeModel.findById.mockImplementation(() => chain(doc));
      seatShowtimeModel.exists.mockImplementation(() => chain({ _id: 'y' }));
      await expectHttp(
        service.updateShowtime(ST_ID, input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG04,
        'SHOWTIME_SOLD',
      );
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('trùng phòng -> 409 MSG03, loại trừ chính nó', async () => {
      const doc = showtimeDoc();
      showtimeModel.findById.mockImplementation(() => chain(doc));
      showtimeModel.exists.mockImplementation(() => chain({ _id: 'x' }));
      await expectHttp(
        service.updateShowtime(ST_ID, input()),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG03,
        'ROOM_CONFLICT',
      );
      expect(showtimeModel.exists).toHaveBeenCalledWith(
        expect.objectContaining({ _id: { $ne: new Types.ObjectId(ST_ID) } }),
      );
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('đổi phòng -> xóa và sinh lại ghế', async () => {
      const newRoomId = new Types.ObjectId().toString();
      const doc = showtimeDoc();
      showtimeModel.findById.mockImplementation(() => chain(doc));
      await service.updateShowtime(ST_ID, input({ roomId: newRoomId }));
      expect((doc.roomId as Types.ObjectId).toString()).toBe(newRoomId);
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(seatShowtimeModel.deleteMany).toHaveBeenCalledWith({
        showtimeId: new Types.ObjectId(ST_ID),
      });
      expect(seatShowtimeModel.insertMany).toHaveBeenCalledTimes(1);
    });

    it('giữ phòng -> không đụng ghế, cập nhật snapshot', async () => {
      const doc = showtimeDoc();
      showtimeModel.findById.mockImplementation(() => chain(doc));
      const result = await service.updateShowtime(ST_ID, input());
      expect(seatShowtimeModel.deleteMany).not.toHaveBeenCalled();
      expect(seatShowtimeModel.insertMany).not.toHaveBeenCalled();
      expect(doc.seatPriceSelections).toEqual(
        input().seatPriceSelections?.map((s) => ({
          ...s,
          ruleId: new Types.ObjectId(s.ruleId!),
        })),
      );
      expect(result.showtimeId).toBe(ST_ID);
    });

    it('lỗi DB -> 500', async () => {
      showtimeModel.findById.mockImplementation(() => rejectChain());
      await expectHttp(
        service.updateShowtime(ST_ID, input()),
        InternalServerErrorException,
      );
    });
  });

  describe('deleteShowtime', () => {
    it('không tồn tại -> 404', async () => {
      showtimeModel.findById.mockImplementation(() => chain(null));
      await expectHttp(
        service.deleteShowtime(new Types.ObjectId().toString()),
        NotFoundException,
      );
    });

    it('đã bán vé -> 409 MSG05, không xóa gì', async () => {
      seatShowtimeModel.exists.mockImplementation(() => chain({ _id: 'y' }));
      await expectHttp(
        service.deleteShowtime(ST_ID),
        ConflictException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG05,
        'SHOWTIME_SOLD',
      );
      expect(seatShowtimeModel.deleteMany).not.toHaveBeenCalled();
      expect(showtimeModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('thành công -> xóa ghế rồi suất và trả bản ghi đã xóa', async () => {
      const order: string[] = [];
      seatShowtimeModel.deleteMany.mockImplementation(() => {
        order.push('seats');
        return chain({});
      });
      showtimeModel.findByIdAndDelete.mockImplementation(() => {
        order.push('showtime');
        return chain({});
      });
      const result = await service.deleteShowtime(ST_ID);
      expect(order).toEqual(['seats', 'showtime']);
      expect(result.showtimeId).toBe(ST_ID);
    });

    it('lỗi DB -> 500', async () => {
      showtimeModel.findByIdAndDelete.mockImplementation(() => rejectChain());
      await expectHttp(
        service.deleteShowtime(ST_ID),
        InternalServerErrorException,
        SHOWTIME_SCHEDULE_MESSAGES.MSG_SCHEDULE_FAILED,
      );
    });
  });
});
