import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Page } from '../../../../common/dto/page.dto';
import { MovieOptionQueryService } from '../../../movie/application/services/movie-option-query.service';
import { PriceRuleOptionQueryService } from '../../../pricerule/application/services/price-rule-option-query.service';
import { RoomOptionQueryService } from '../../../room/application/services/room-option-query.service';
import { ShowtimeQueryService } from '../../../showtime/application/services/showtime-query.service';
import { ShowtimeScheduleService } from '../../../showtime/application/services/showtime-schedule.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { SaveShowtimeReqDto } from '../dto/req.dto';
import { ManagedShowtimeService } from './managed-showtime.service';

const NOW = new Date('2026-10-23T03:00:00Z'); // 10:00 VN
const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const ST_A_START = new Date('2026-10-25T02:30:00Z');
const ST_A_END = new Date('2026-10-25T05:16:00Z');

const MOVIE_166 = {
  movieId: 'm-1',
  movieName: 'Dune: Part Two',
  duration: 166,
  status: 'NOW_SHOWING',
  isActive: true,
  posterUrl: 'https://cdn/x.jpg',
};
const MOVIE_FIXTURES: Record<string, typeof MOVIE_166> = {
  'm-1': MOVIE_166,
  'm-end': { ...MOVIE_166, movieId: 'm-end', status: 'ENDED' },
  'm-off': { ...MOVIE_166, movieId: 'm-off', isActive: false },
};
const MOCK_ROOMS = [
  {
    roomId: 'r-1',
    roomName: 'Phòng 1',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_A,
  },
  {
    roomId: 'r-2',
    roomName: 'Phòng 2',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_A,
  },
  {
    roomId: 'r-3',
    roomName: 'Phòng 3',
    roomStatus: 'MAINTENANCE',
    branchId: BRANCH_A,
  },
  {
    roomId: 'r-9',
    roomName: 'Phòng X',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH_B,
  },
];
const RESOLVED = {
  seatPriceSelections: [
    { seatType: 'VIP', ruleId: 'a1', multiplier: 1.7 },
    { seatType: 'COUPLE', ruleId: null, multiplier: 1 },
  ],
  dayPriceSelections: [
    { dayType: 'WEEKEND', ruleId: null, multiplier: 1 },
    { dayType: 'HOLIDAY', ruleId: null, multiplier: 1 },
  ],
};
const OLD_SNAPSHOT = {
  seatPriceSelections: [{ seatType: 'VIP', ruleId: 'old', multiplier: 1.5 }],
  dayPriceSelections: [{ dayType: 'WEEKEND', ruleId: 'oldd', multiplier: 1.2 }],
};
const ST_A_RES = {
  showtimeId: 'st-1',
  movieId: 'm-1',
  roomId: 'r-1',
  startTime: ST_A_START,
  endTime: ST_A_END,
  basePrice: 80000,
  ...OLD_SNAPSHOT,
  createdAt: NOW,
  updatedAt: NOW,
};
const ST_B_RES = { ...ST_A_RES, showtimeId: 'st-b', roomId: 'r-9' };

const VALID: SaveShowtimeReqDto = {
  movieId: 'm-1',
  screeningDate: '2026-10-25',
  startTime: '09:30',
  roomId: 'r-1',
};

const argOf = (fn: jest.Mock, call: number, arg: number): unknown =>
  (fn.mock.calls as unknown[][])[call][arg];

describe('ManagedShowtimeService', () => {
  let service: ManagedShowtimeService;

  const userBranch = { getBranchIdOfUser: jest.fn() };
  const movieQuery = {
    getMovieSchedulingInfo: jest.fn(),
    getMovieSchedulingInfos: jest.fn(),
  };
  const roomQuery = {
    listRoomsByBranch: jest.fn(),
    getRoomSchedulingInfo: jest.fn(),
  };
  const showtimeQuery = {
    searchShowtimesByRooms: jest.fn(),
    getShowtimeDetail: jest.fn(),
  };
  const schedule = {
    hasSoldTickets: jest.fn(),
    findSoldShowtimeIds: jest.fn(),
    createShowtime: jest.fn(),
    updateShowtime: jest.fn(),
    deleteShowtime: jest.fn(),
  };
  const priceRule = { resolvePriceSelections: jest.fn() };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.resetAllMocks();
    userBranch.getBranchIdOfUser.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'mgr-a' ? BRANCH_A : id === 'mgr-b' ? BRANCH_B : null,
      ),
    );
    movieQuery.getMovieSchedulingInfo.mockImplementation((id: string) =>
      Promise.resolve(MOVIE_FIXTURES[id] ?? null),
    );
    movieQuery.getMovieSchedulingInfos.mockImplementation((ids: string[]) =>
      Promise.resolve(ids.includes('m-1') ? [MOVIE_166] : []),
    );
    roomQuery.listRoomsByBranch.mockImplementation((b: string) =>
      Promise.resolve(MOCK_ROOMS.filter((r) => r.branchId === b)),
    );
    roomQuery.getRoomSchedulingInfo.mockImplementation((id: string) =>
      Promise.resolve(MOCK_ROOMS.find((r) => r.roomId === id) ?? null),
    );
    showtimeQuery.searchShowtimesByRooms.mockResolvedValue(
      Page.from([ST_A_RES], 1, 1, 10),
    );
    showtimeQuery.getShowtimeDetail.mockImplementation((id: string) => {
      if (id === 'st-1') return Promise.resolve(ST_A_RES);
      if (id === 'st-b') return Promise.resolve(ST_B_RES);
      return Promise.reject(new NotFoundException('Showtime not found'));
    });
    schedule.hasSoldTickets.mockResolvedValue(false);
    schedule.findSoldShowtimeIds.mockResolvedValue(new Set<string>());
    schedule.createShowtime.mockImplementation((i: object) =>
      Promise.resolve({
        showtimeId: 'st-new',
        ...i,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    schedule.updateShowtime.mockImplementation((id: string, i: object) =>
      Promise.resolve({ showtimeId: id, ...i, createdAt: NOW, updatedAt: NOW }),
    );
    schedule.deleteShowtime.mockResolvedValue(ST_A_RES);
    priceRule.resolvePriceSelections.mockResolvedValue(RESOLVED);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ManagedShowtimeService,
        { provide: UserBranchQueryService, useValue: userBranch },
        { provide: MovieOptionQueryService, useValue: movieQuery },
        { provide: RoomOptionQueryService, useValue: roomQuery },
        { provide: ShowtimeQueryService, useValue: showtimeQuery },
        { provide: ShowtimeScheduleService, useValue: schedule },
        { provide: PriceRuleOptionQueryService, useValue: priceRule },
      ],
    }).compile();
    service = moduleRef.get(ManagedShowtimeService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const getResponse = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (e) {
      return (e as HttpException).getResponse() as Record<string, unknown>;
    }
    throw new Error('expected rejection');
  };

  describe('listShowtimes', () => {
    it('Manager chưa có chi nhánh -> 403', async () => {
      await expect(
        service.listShowtimes('mgr-none', { page: 1, limit: 10 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(showtimeQuery.searchShowtimesByRooms).not.toHaveBeenCalled();
    });

    it('cách ly chi nhánh: chỉ truyền roomIds của chi nhánh Manager', async () => {
      await service.listShowtimes('mgr-a', { page: 1, limit: 10 });
      expect(argOf(showtimeQuery.searchShowtimesByRooms, 0, 0)).toEqual([
        'r-1',
        'r-2',
        'r-3',
      ]);
      await service.listShowtimes('mgr-b', { page: 1, limit: 10 });
      expect(argOf(showtimeQuery.searchShowtimesByRooms, 1, 0)).toEqual([
        'r-9',
      ]);
    });

    it('mặc định chỉ từ đầu hôm nay (giờ VN)', async () => {
      await service.listShowtimes('mgr-a', { page: 1, limit: 10 });
      const filter = argOf(showtimeQuery.searchShowtimesByRooms, 0, 1) as {
        from?: Date;
        to?: Date;
      };
      expect(filter.from?.toISOString()).toBe('2026-10-22T17:00:00.000Z');
      expect(filter.to).toBeUndefined();
    });

    it('includePast -> không giới hạn from/to', async () => {
      await service.listShowtimes('mgr-a', {
        page: 1,
        limit: 10,
        includePast: true,
      });
      const filter = argOf(showtimeQuery.searchShowtimesByRooms, 0, 1) as {
        from?: Date;
        to?: Date;
      };
      expect(filter.from).toBeUndefined();
      expect(filter.to).toBeUndefined();
    });

    it('date -> khoảng [00:00, 24:00) giờ VN', async () => {
      await service.listShowtimes('mgr-a', {
        page: 1,
        limit: 10,
        date: '2026-10-25',
      });
      const filter = argOf(showtimeQuery.searchShowtimesByRooms, 0, 1) as {
        from?: Date;
        to?: Date;
      };
      expect(filter.from?.toISOString()).toBe('2026-10-24T17:00:00.000Z');
      expect(filter.to?.toISOString()).toBe('2026-10-25T17:00:00.000Z');
    });

    it('roomId không thuộc chi nhánh -> Page rỗng, không truy vấn', async () => {
      const page = await service.listShowtimes('mgr-a', {
        page: 1,
        limit: 10,
        roomId: 'r-9',
      });
      expect(page.items).toEqual([]);
      expect(page.total).toBe(0);
      expect(showtimeQuery.searchShowtimesByRooms).not.toHaveBeenCalled();
    });

    it('ghép tên phim/phòng và hasSoldTickets từ findSoldShowtimeIds', async () => {
      schedule.findSoldShowtimeIds.mockResolvedValue(new Set(['st-1']));
      const page = await service.listShowtimes('mgr-a', { page: 1, limit: 10 });
      expect(schedule.findSoldShowtimeIds).toHaveBeenCalledWith(['st-1']);
      expect(page.total).toBe(1);
      expect(page.items[0]).toMatchObject({
        showtimeId: 'st-1',
        movieName: 'Dune: Part Two',
        movieDuration: 166,
        posterUrl: 'https://cdn/x.jpg',
        roomName: 'Phòng 1',
        hasSoldTickets: true,
        seatPriceSelections: OLD_SNAPSHOT.seatPriceSelections,
        dayPriceSelections: OLD_SNAPSHOT.dayPriceSelections,
      });
    });

    it('lỗi lạ -> 500 MSG_LOAD_FAILED, không rò rỉ', async () => {
      showtimeQuery.searchShowtimesByRooms.mockRejectedValue(
        new Error('mongo down'),
      );
      const err = await service
        .listShowtimes('mgr-a', { page: 1, limit: 10 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as HttpException).message).toBe('Unable to load showtimes.');
    });
  });

  describe('getShowtime', () => {
    it('suất của chi nhánh -> trả chi tiết', async () => {
      const dto = await service.getShowtime('mgr-a', 'st-1');
      expect(dto.showtimeId).toBe('st-1');
      expect(dto.roomName).toBe('Phòng 1');
    });

    it('suất chi nhánh khác -> 404', async () => {
      await expect(service.getShowtime('mgr-a', 'st-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('suất không tồn tại -> 404 MSG_NOT_FOUND', async () => {
      await expect(service.getShowtime('mgr-a', 'zzz')).rejects.toMatchObject({
        message: 'Showtime not found.',
        status: 404,
      });
    });

    it('chưa có chi nhánh -> 403', async () => {
      await expect(
        service.getShowtime('mgr-none', 'st-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('createShowtime', () => {
    it('thành công: endTime = start + duration, basePrice mặc định, snapshot, MSG02', async () => {
      const res = await service.createShowtime('mgr-a', VALID);
      expect(priceRule.resolvePriceSelections).toHaveBeenCalledWith([]);
      expect(schedule.createShowtime).toHaveBeenCalledTimes(1);
      const input = argOf(schedule.createShowtime, 0, 0) as Record<
        string,
        unknown
      >;
      expect(input).toEqual({
        movieId: 'm-1',
        roomId: 'r-1',
        startTime: new Date('2026-10-25T02:30:00Z'),
        endTime: new Date('2026-10-25T05:16:00Z'),
        basePrice: 75000,
        seatPriceSelections: RESOLVED.seatPriceSelections,
        dayPriceSelections: RESOLVED.dayPriceSelections,
      });
      expect(res.message).toBe('Changes saved successfully.');
      expect(res.showtime).toMatchObject({
        showtimeId: 'st-new',
        movieName: 'Dune: Part Two',
        roomName: 'Phòng 1',
        hasSoldTickets: false,
      });
    });

    it('qua nửa đêm: 23:30 + 166 phút', async () => {
      await service.createShowtime('mgr-a', { ...VALID, startTime: '23:30' });
      const input = argOf(schedule.createShowtime, 0, 0) as {
        startTime: Date;
        endTime: Date;
      };
      expect(input.startTime.toISOString()).toBe('2026-10-25T16:30:00.000Z');
      expect(input.endTime.toISOString()).toBe('2026-10-25T19:16:00.000Z');
    });

    it('basePrice request được dùng; priceSelections ánh xạ {group,fieldKey,ruleId}', async () => {
      await service.createShowtime('mgr-a', {
        ...VALID,
        basePrice: 90000,
        priceSelections: [{ group: 'SEAT', fieldKey: 'VIP', ruleId: 'a1' }],
      });
      expect(priceRule.resolvePriceSelections).toHaveBeenCalledWith([
        { group: 'SEAT', fieldKey: 'VIP', ruleId: 'a1' },
      ]);
      expect(argOf(schedule.createShowtime, 0, 0)).toMatchObject({
        basePrice: 90000,
      });
    });

    it('chưa có chi nhánh -> 403 và không gọi bước sau', async () => {
      await expect(
        service.createShowtime('mgr-none', VALID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(movieQuery.getMovieSchedulingInfo).not.toHaveBeenCalled();
    });

    it.each(['m-zzz', 'm-end', 'm-off'])(
      'phim %s -> 400 MSG_INVALID_MOVIE, không gọi bước sau',
      async (movieId) => {
        const res = await getResponse(
          service.createShowtime('mgr-a', { ...VALID, movieId }),
        );
        expect(res.errors).toEqual([
          {
            field: 'movieId',
            message: 'Selected movie is invalid or no longer available.',
          },
        ]);
        expect(roomQuery.getRoomSchedulingInfo).not.toHaveBeenCalled();
        expect(priceRule.resolvePriceSelections).not.toHaveBeenCalled();
        expect(schedule.createShowtime).not.toHaveBeenCalled();
      },
    );

    it.each(['r-9', 'r-zzz'])(
      'phòng %s (khác chi nhánh/không tồn tại) -> 400 MSG_INVALID_ROOM',
      async (roomId) => {
        const res = await getResponse(
          service.createShowtime('mgr-a', { ...VALID, roomId }),
        );
        expect(res.errors).toEqual([
          { field: 'roomId', message: 'Selected screening room is invalid.' },
        ]);
        expect(priceRule.resolvePriceSelections).not.toHaveBeenCalled();
        expect(schedule.createShowtime).not.toHaveBeenCalled();
      },
    );

    it('phòng bảo trì -> 400 MSG_ROOM_NOT_ACTIVE', async () => {
      const res = await getResponse(
        service.createShowtime('mgr-a', { ...VALID, roomId: 'r-3' }),
      );
      expect(res.errors).toEqual([
        { field: 'roomId', message: 'Selected screening room is not active.' },
      ]);
      expect(schedule.createShowtime).not.toHaveBeenCalled();
    });

    it('startTime trong quá khứ -> 400 MSG_PAST_START, không resolve hệ số', async () => {
      const res = await getResponse(
        service.createShowtime('mgr-a', {
          ...VALID,
          screeningDate: '2026-10-23',
          startTime: '09:00',
        }),
      );
      expect(res.errors).toEqual([
        { field: 'startTime', message: 'Start time must be in the future.' },
      ]);
      expect(priceRule.resolvePriceSelections).not.toHaveBeenCalled();
      expect(schedule.createShowtime).not.toHaveBeenCalled();
    });

    it('MSG_INVALID_SELECTION của UC-05 giữ nguyên 400, không ghi', async () => {
      priceRule.resolvePriceSelections.mockRejectedValue(
        new BadRequestException('Selected price value is invalid'),
      );
      const err = await service
        .createShowtime('mgr-a', VALID)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toBe(
        'Selected price value is invalid',
      );
      expect(schedule.createShowtime).not.toHaveBeenCalled();
    });

    it('trùng phòng: 409 MSG03 từ ShowtimeScheduleService giữ nguyên code', async () => {
      schedule.createShowtime.mockRejectedValue(
        new ConflictException({
          statusCode: 409,
          message: 'room conflict',
          error: 'Conflict',
          code: 'ROOM_CONFLICT',
        }),
      );
      const res = await getResponse(service.createShowtime('mgr-a', VALID));
      expect(res.code).toBe('ROOM_CONFLICT');
    });

    it('lỗi lạ -> 500 MSG_SAVE_FAILED', async () => {
      schedule.createShowtime.mockRejectedValue(new Error('mongo down'));
      const err = await service
        .createShowtime('mgr-a', VALID)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as HttpException).message).toBe(
        'Unable to save showtime due to system failure. Please try again later.',
      );
    });

    it('ngày không tồn tại -> 400 MSG_INVALID_DATE', async () => {
      const res = await getResponse(
        service.createShowtime('mgr-a', {
          ...VALID,
          screeningDate: '2026-02-30',
        }),
      );
      expect(res.errors).toEqual([
        { field: 'screeningDate', message: 'Screening date is invalid.' },
      ]);
    });
  });

  describe('updateShowtime', () => {
    it('suất chi nhánh khác -> 404, không gọi schedule', async () => {
      await expect(
        service.updateShowtime('mgr-a', 'st-b', VALID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(schedule.hasSoldTickets).not.toHaveBeenCalled();
      expect(schedule.updateShowtime).not.toHaveBeenCalled();
    });

    it('đã bán vé -> 409 MSG04 SHOWTIME_SOLD, không ghi', async () => {
      schedule.hasSoldTickets.mockResolvedValue(true);
      const res = await getResponse(
        service.updateShowtime('mgr-a', 'st-1', VALID),
      );
      expect(res).toEqual({
        statusCode: 409,
        message: 'Cannot edit a showtime that already has tickets sold.',
        error: 'Conflict',
        code: 'SHOWTIME_SOLD',
      });
      expect(movieQuery.getMovieSchedulingInfo).not.toHaveBeenCalled();
      expect(schedule.updateShowtime).not.toHaveBeenCalled();
    });

    it('priceSelections thiếu -> giữ snapshot cũ, không resolve', async () => {
      const res = await service.updateShowtime('mgr-a', 'st-1', VALID);
      expect(priceRule.resolvePriceSelections).not.toHaveBeenCalled();
      const [id, input] = schedule.updateShowtime.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(id).toBe('st-1');
      expect(input).toMatchObject({
        basePrice: 80000,
        seatPriceSelections: OLD_SNAPSHOT.seatPriceSelections,
        dayPriceSelections: OLD_SNAPSHOT.dayPriceSelections,
      });
      expect(res.message).toBe('Changes saved successfully.');
    });

    it('priceSelections có mặt (kể cả []) -> resolve lại', async () => {
      await service.updateShowtime('mgr-a', 'st-1', {
        ...VALID,
        priceSelections: [],
      });
      expect(priceRule.resolvePriceSelections).toHaveBeenCalledWith([]);
      expect(argOf(schedule.updateShowtime, 0, 1)).toMatchObject({
        seatPriceSelections: RESOLVED.seatPriceSelections,
      });
    });

    it('suất đã qua, giờ/phòng không đổi -> không MSG_PAST_START', async () => {
      jest.setSystemTime(new Date('2026-10-26T00:00:00Z')); // sau suất
      await expect(
        service.updateShowtime('mgr-a', 'st-1', VALID),
      ).resolves.toBeDefined();
      expect(schedule.updateShowtime).toHaveBeenCalledTimes(1);
    });

    it('đổi giờ sang quá khứ -> 400 MSG_PAST_START', async () => {
      const res = await getResponse(
        service.updateShowtime('mgr-a', 'st-1', {
          ...VALID,
          screeningDate: '2026-10-23',
          startTime: '09:00',
        }),
      );
      expect(res.errors).toEqual([
        { field: 'startTime', message: 'Start time must be in the future.' },
      ]);
      expect(schedule.updateShowtime).not.toHaveBeenCalled();
    });

    it('đổi phòng sang quá khứ cũng kiểm tra MSG_PAST_START', async () => {
      jest.setSystemTime(new Date('2026-10-26T00:00:00Z'));
      const res = await getResponse(
        service.updateShowtime('mgr-a', 'st-1', { ...VALID, roomId: 'r-2' }),
      );
      expect((res.errors as { field: string }[])[0].field).toBe('startTime');
    });

    it('đổi phim -> endTime tính lại theo thời lượng mới', async () => {
      movieQuery.getMovieSchedulingInfo.mockResolvedValue({
        ...MOVIE_166,
        movieId: 'm-2',
        duration: 96,
      });
      await service.updateShowtime('mgr-a', 'st-1', {
        ...VALID,
        movieId: 'm-2',
      });
      const input = argOf(schedule.updateShowtime, 0, 1) as {
        endTime: Date;
      };
      expect(input.endTime.toISOString()).toBe('2026-10-25T04:06:00.000Z');
    });

    it('409 MSG03 từ schedule (loại trừ chính nó ở đó) giữ nguyên', async () => {
      schedule.updateShowtime.mockRejectedValue(
        new ConflictException({ code: 'ROOM_CONFLICT' }),
      );
      const res = await getResponse(
        service.updateShowtime('mgr-a', 'st-1', VALID),
      );
      expect(res.code).toBe('ROOM_CONFLICT');
    });

    it('lỗi lạ -> 500 MSG_SAVE_FAILED', async () => {
      schedule.updateShowtime.mockRejectedValue(new Error('boom'));
      await expect(
        service.updateShowtime('mgr-a', 'st-1', VALID),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('deleteShowtime', () => {
    it('suất chi nhánh khác -> 404, không xóa', async () => {
      await expect(
        service.deleteShowtime('mgr-a', 'st-b'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(schedule.deleteShowtime).not.toHaveBeenCalled();
    });

    it('đã bán vé -> 409 MSG05 SHOWTIME_SOLD, không xóa', async () => {
      schedule.hasSoldTickets.mockResolvedValue(true);
      const res = await getResponse(service.deleteShowtime('mgr-a', 'st-1'));
      expect(res).toEqual({
        statusCode: 409,
        message: 'Cannot delete a showtime that already has tickets sold.',
        error: 'Conflict',
        code: 'SHOWTIME_SOLD',
      });
      expect(schedule.deleteShowtime).not.toHaveBeenCalled();
    });

    it('thành công -> MSG02 và bản ghi vừa xóa', async () => {
      const res = await service.deleteShowtime('mgr-a', 'st-1');
      expect(schedule.deleteShowtime).toHaveBeenCalledWith('st-1');
      expect(res.message).toBe('Changes saved successfully.');
      expect(res.showtime.showtimeId).toBe('st-1');
      expect(res.showtime.movieName).toBe('Dune: Part Two');
    });

    it('tra phim lỗi -> 500 và KHÔNG xóa dữ liệu', async () => {
      movieQuery.getMovieSchedulingInfo.mockRejectedValue(new Error('down'));
      await expect(
        service.deleteShowtime('mgr-a', 'st-1'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(schedule.deleteShowtime).not.toHaveBeenCalled();
    });

    it('lỗi lạ -> 500 MSG_SAVE_FAILED', async () => {
      schedule.deleteShowtime.mockRejectedValue(new Error('boom'));
      await expect(
        service.deleteShowtime('mgr-a', 'st-1'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
