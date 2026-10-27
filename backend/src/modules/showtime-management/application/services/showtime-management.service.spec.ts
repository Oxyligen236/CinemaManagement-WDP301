import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Page } from '../../../../common/dto/page.dto';
import { AuthenticatedUser } from '../../../auth/domain/types/authenticated-user.type';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import { MovieOptionQueryService } from '../../../movie/application/services/movie-option-query.service';
import { PriceRuleOptionQueryService } from '../../../pricerule/application/services/price-rule-option-query.service';
import { RoomOptionQueryService } from '../../../room/application/services/room-option-query.service';
import { ShowtimeQueryService } from '../../../showtime/application/services/showtime-query.service';
import { ShowtimeScheduleService } from '../../../showtime/application/services/showtime-schedule.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { Role } from '../../../user/domain/enums/role.enum';
import {
  MSG02,
  MSG_NO_BRANCH,
} from '../../domain/constants/showtime-management.constants';
import { SaveShowtimeReqDto } from '../dto/req.dto';
import { ShowtimeManagementService } from './showtime-management.service';

const MANAGER: AuthenticatedUser = {
  userId: 'u-1',
  email: 'm@x.com',
  role: Role.BRANCHMANAGER,
};
const BRANCH = 'b-1';
const ROOMS = [
  {
    roomId: 'r-1',
    roomName: 'Room 1',
    roomStatus: 'AVAILABLE',
    branchId: BRANCH,
  },
  {
    roomId: 'r-2',
    roomName: 'Room 2',
    roomStatus: 'MAINTENANCE',
    branchId: BRANCH,
  },
];
const MOVIE = {
  movieId: 'm-1',
  movieName: 'Dune',
  duration: 120,
  status: 'NOW_SHOWING',
  isActive: true,
};
const SELECTIONS = {
  seatPriceSelections: [{ seatType: 'VIP', ruleId: 'a1', multiplier: 1.5 }],
  dayPriceSelections: [{ dayType: 'WEEKEND', ruleId: null, multiplier: 1 }],
};

const showtimeRes = (over: Record<string, unknown> = {}) => ({
  showtimeId: 'st-1',
  movieId: 'm-1',
  roomId: 'r-1',
  startTime: new Date('2030-01-01T02:00:00.000Z'),
  endTime: new Date('2030-01-01T04:00:00.000Z'),
  basePrice: 80000,
  ...SELECTIONS,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const body = (over: Partial<SaveShowtimeReqDto> = {}): SaveShowtimeReqDto =>
  Object.assign(new SaveShowtimeReqDto(), {
    movieId: 'm-1',
    screeningDate: '2030-01-01',
    startTime: '09:00',
    roomId: 'r-1',
    ...over,
  });

describe('ShowtimeManagementService', () => {
  let service: ShowtimeManagementService;
  const userBranch = { getBranchIdOfUser: jest.fn() };
  const branch = { getBranchSummary: jest.fn() };
  const movies = {
    searchMovieOptions: jest.fn(),
    getMovieSchedulingInfo: jest.fn(),
    getMovieSchedulingInfos: jest.fn(),
  };
  const rooms = { listRoomsByBranch: jest.fn() };
  const showtimeQuery = {
    getShowtimeDetail: jest.fn(),
    searchShowtimesByRooms: jest.fn(),
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
    jest.resetAllMocks();
    userBranch.getBranchIdOfUser.mockResolvedValue(BRANCH);
    branch.getBranchSummary.mockResolvedValue({
      branchId: BRANCH,
      branchName: 'CGV 1',
    });
    rooms.listRoomsByBranch.mockResolvedValue(ROOMS);
    movies.getMovieSchedulingInfo.mockResolvedValue(MOVIE);
    movies.getMovieSchedulingInfos.mockResolvedValue([MOVIE]);
    schedule.findSoldShowtimeIds.mockResolvedValue(new Set<string>());
    schedule.hasSoldTickets.mockResolvedValue(false);
    priceRule.resolvePriceSelections.mockResolvedValue(SELECTIONS);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShowtimeManagementService,
        { provide: UserBranchQueryService, useValue: userBranch },
        { provide: BranchQueryService, useValue: branch },
        { provide: MovieOptionQueryService, useValue: movies },
        { provide: RoomOptionQueryService, useValue: rooms },
        { provide: ShowtimeQueryService, useValue: showtimeQuery },
        { provide: ShowtimeScheduleService, useValue: schedule },
        { provide: PriceRuleOptionQueryService, useValue: priceRule },
      ],
    }).compile();
    service = moduleRef.get(ShowtimeManagementService);
  });

  describe('getContext', () => {
    it('trả chi nhánh của manager', async () => {
      await expect(service.getContext(MANAGER)).resolves.toEqual({
        branchId: BRANCH,
        branchName: 'CGV 1',
      });
    });

    it('403 NO_BRANCH khi manager chưa được gán chi nhánh', async () => {
      userBranch.getBranchIdOfUser.mockResolvedValue(null);
      const promise = service.getContext(MANAGER);
      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toMatchObject({ message: MSG_NO_BRANCH });
    });
  });

  describe('listShowtimes', () => {
    it('chỉ truy vấn các phòng của chi nhánh và gắn hasSoldTickets', async () => {
      showtimeQuery.searchShowtimesByRooms.mockResolvedValue(
        Page.from([showtimeRes()], 1, 1, 10),
      );
      schedule.findSoldShowtimeIds.mockResolvedValue(new Set(['st-1']));

      const result = await service.listShowtimes(MANAGER, {
        page: 1,
        limit: 10,
      });

      expect(showtimeQuery.searchShowtimesByRooms).toHaveBeenCalledWith(
        ['r-1', 'r-2'],
        expect.objectContaining({ from: expect.any(Date) }),
        1,
        10,
      );
      expect(result.items[0]).toMatchObject({
        showtimeId: 'st-1',
        movieName: 'Dune',
        roomName: 'Room 1',
        hasSoldTickets: true,
      });
    });

    it('lọc theo ngày giờ rạp và bỏ qua giới hạn hôm nay', async () => {
      showtimeQuery.searchShowtimesByRooms.mockResolvedValue(
        Page.from([], 0, 1, 10),
      );
      await service.listShowtimes(MANAGER, {
        page: 1,
        limit: 10,
        date: '2026-10-25',
      });
      const filter = showtimeQuery.searchShowtimesByRooms.mock.calls[0][1] as {
        from: Date;
        to: Date;
      };
      expect(filter.from.toISOString()).toBe('2026-10-24T17:00:00.000Z');
      expect(filter.to.toISOString()).toBe('2026-10-25T17:00:00.000Z');
    });

    it('includePast=true không giới hạn startTime', async () => {
      showtimeQuery.searchShowtimesByRooms.mockResolvedValue(
        Page.from([], 0, 1, 10),
      );
      await service.listShowtimes(MANAGER, {
        page: 1,
        limit: 10,
        includePast: true,
      });
      const filter = showtimeQuery.searchShowtimesByRooms.mock.calls[0][1] as {
        from?: Date;
      };
      expect(filter.from).toBeUndefined();
    });

    it('400 khi date không tồn tại trên lịch', async () => {
      await expect(
        service.listShowtimes(MANAGER, {
          page: 1,
          limit: 10,
          date: '2026-02-30',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getShowtime', () => {
    it('404 khi suất thuộc phòng của chi nhánh khác', async () => {
      showtimeQuery.getShowtimeDetail.mockResolvedValue(
        showtimeRes({ roomId: 'r-other' }),
      );
      await expect(service.getShowtime(MANAGER, 'st-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404 khi suất không tồn tại', async () => {
      showtimeQuery.getShowtimeDetail.mockRejectedValue(
        new NotFoundException('Showtime not found'),
      );
      await expect(service.getShowtime(MANAGER, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createShowtime', () => {
    it('tính endTime từ thời lượng phim và lưu snapshot hệ số', async () => {
      schedule.createShowtime.mockResolvedValue(showtimeRes());

      const result = await service.createShowtime(MANAGER, body());

      const input = schedule.createShowtime.mock.calls[0][0] as {
        startTime: Date;
        endTime: Date;
        basePrice: number;
      };
      expect(input.startTime.toISOString()).toBe('2030-01-01T02:00:00.000Z');
      expect(input.endTime.toISOString()).toBe('2030-01-01T04:00:00.000Z');
      expect(input.basePrice).toBe(75000);
      expect(schedule.createShowtime).toHaveBeenCalledWith(
        expect.objectContaining(SELECTIONS),
      );
      expect(result.message).toBe(MSG02);
      expect(result.showtime.hasSoldTickets).toBe(false);
    });

    it('400 khi phim không hợp lệ hoặc đã ENDED', async () => {
      movies.getMovieSchedulingInfo.mockResolvedValue({
        ...MOVIE,
        status: 'ENDED',
      });
      await expect(
        service.createShowtime(MANAGER, body()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(schedule.createShowtime).not.toHaveBeenCalled();
    });

    it('400 khi phòng không thuộc chi nhánh', async () => {
      await expect(
        service.createShowtime(MANAGER, body({ roomId: 'r-other' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 khi phòng không ở trạng thái AVAILABLE', async () => {
      await expect(
        service.createShowtime(MANAGER, body({ roomId: 'r-2' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 khi giờ bắt đầu ở quá khứ', async () => {
      await expect(
        service.createShowtime(MANAGER, body({ screeningDate: '2020-01-01' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(schedule.createShowtime).not.toHaveBeenCalled();
    });

    it('400 khi ngày không tồn tại trên lịch', async () => {
      await expect(
        service.createShowtime(MANAGER, body({ screeningDate: '2030-02-30' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('giữ nguyên 409 khi phòng bị trùng lịch', async () => {
      schedule.createShowtime.mockRejectedValue(
        new ConflictException({ code: 'ROOM_CONFLICT' }),
      );
      await expect(
        service.createShowtime(MANAGER, body()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('500 MSG_SAVE_FAILED khi lỗi không xác định', async () => {
      schedule.createShowtime.mockRejectedValue(new Error('db down'));
      await expect(
        service.createShowtime(MANAGER, body()),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('updateShowtime', () => {
    beforeEach(() => {
      showtimeQuery.getShowtimeDetail.mockResolvedValue(showtimeRes());
    });

    it('409 SHOWTIME_SOLD khi suất đã bán vé', async () => {
      schedule.hasSoldTickets.mockResolvedValue(true);
      const promise = service.updateShowtime(MANAGER, 'st-1', body());
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        response: { code: 'SHOWTIME_SOLD' },
      });
      expect(schedule.updateShowtime).not.toHaveBeenCalled();
    });

    it('thiếu priceSelections -> giữ snapshot cũ, thiếu basePrice -> giữ giá cũ', async () => {
      schedule.updateShowtime.mockResolvedValue(showtimeRes());

      await service.updateShowtime(MANAGER, 'st-1', body());

      expect(priceRule.resolvePriceSelections).not.toHaveBeenCalled();
      expect(schedule.updateShowtime).toHaveBeenCalledWith(
        'st-1',
        expect.objectContaining({ basePrice: 80000, ...SELECTIONS }),
      );
    });

    it('priceSelections có mặt (kể cả []) -> resolve lại', async () => {
      schedule.updateShowtime.mockResolvedValue(showtimeRes());
      await service.updateShowtime(
        MANAGER,
        'st-1',
        body({ priceSelections: [] }),
      );
      expect(priceRule.resolvePriceSelections).toHaveBeenCalledWith([]);
    });

    it('409 SHOWTIME_STARTED khi suất đã/đang chiếu', async () => {
      showtimeQuery.getShowtimeDetail.mockResolvedValue(
        showtimeRes({ startTime: new Date('2020-01-01T02:00:00.000Z') }),
      );
      const promise = service.updateShowtime(MANAGER, 'st-1', body());
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        response: { code: 'SHOWTIME_STARTED' },
      });
      expect(schedule.hasSoldTickets).not.toHaveBeenCalled();
      expect(schedule.updateShowtime).not.toHaveBeenCalled();
    });

    it('400 khi dời suất chưa chiếu sang thời điểm quá khứ', async () => {
      await expect(
        service.updateShowtime(
          MANAGER,
          'st-1',
          body({ screeningDate: '2020-01-02' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(schedule.updateShowtime).not.toHaveBeenCalled();
    });
  });

  describe('deleteShowtime', () => {
    it('xóa suất thuộc chi nhánh và trả bản ghi vừa xóa', async () => {
      showtimeQuery.getShowtimeDetail.mockResolvedValue(showtimeRes());
      schedule.deleteShowtime.mockResolvedValue(showtimeRes());

      const result = await service.deleteShowtime(MANAGER, 'st-1');

      expect(schedule.deleteShowtime).toHaveBeenCalledWith('st-1');
      expect(result.message).toBe(MSG02);
      expect(result.showtime.showtimeId).toBe('st-1');
    });

    it('404 và không xóa khi suất thuộc chi nhánh khác', async () => {
      showtimeQuery.getShowtimeDetail.mockResolvedValue(
        showtimeRes({ roomId: 'r-other' }),
      );
      await expect(
        service.deleteShowtime(MANAGER, 'st-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(schedule.deleteShowtime).not.toHaveBeenCalled();
    });

    it('409 SHOWTIME_STARTED và không xóa khi suất đã/đang chiếu', async () => {
      showtimeQuery.getShowtimeDetail.mockResolvedValue(
        showtimeRes({ startTime: new Date('2020-01-01T02:00:00.000Z') }),
      );
      const promise = service.deleteShowtime(MANAGER, 'st-1');
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        response: { code: 'SHOWTIME_STARTED' },
      });
      expect(schedule.deleteShowtime).not.toHaveBeenCalled();
    });

    it('giữ nguyên 409 khi suất đã bán vé', async () => {
      showtimeQuery.getShowtimeDetail.mockResolvedValue(showtimeRes());
      schedule.deleteShowtime.mockRejectedValue(
        new ConflictException({ code: 'SHOWTIME_SOLD' }),
      );
      await expect(
        service.deleteShowtime(MANAGER, 'st-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
