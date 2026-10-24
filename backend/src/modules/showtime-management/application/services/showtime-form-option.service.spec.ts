import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Page } from '../../../../common/dto/page.dto';
import { BranchQueryService } from '../../../branch/application/services/branch-query.service';
import { MovieOptionQueryService } from '../../../movie/application/services/movie-option-query.service';
import { RoomOptionQueryService } from '../../../room/application/services/room-option-query.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { ShowtimeFormOptionService } from './showtime-form-option.service';

const MOVIE = {
  movieId: 'm-1',
  movieName: 'Dune: Part Two',
  duration: 166,
  status: 'NOW_SHOWING',
  posterUrl: 'https://cdn/x.jpg',
};
const ROOMS = [
  {
    roomId: 'r-1',
    roomName: 'Phòng 1',
    roomStatus: 'AVAILABLE',
    branchId: 'branch-a',
  },
  {
    roomId: 'r-3',
    roomName: 'Phòng 3',
    roomStatus: 'MAINTENANCE',
    branchId: 'branch-a',
  },
];

describe('ShowtimeFormOptionService', () => {
  let service: ShowtimeFormOptionService;
  const userBranch = { getBranchIdOfUser: jest.fn() };
  const branchQuery = { getBranchSummary: jest.fn() };
  const movieQuery = { searchMovieOptions: jest.fn() };
  const roomQuery = { listRoomsByBranch: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    userBranch.getBranchIdOfUser.mockImplementation((id: string) =>
      Promise.resolve(id === 'mgr-a' ? 'branch-a' : null),
    );
    branchQuery.getBranchSummary.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'branch-a'
          ? { branchId: 'branch-a', branchName: 'CGV Quận 1' }
          : null,
      ),
    );
    movieQuery.searchMovieOptions.mockResolvedValue(
      Page.from([MOVIE], 1, 1, 10),
    );
    roomQuery.listRoomsByBranch.mockResolvedValue(ROOMS);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShowtimeFormOptionService,
        { provide: UserBranchQueryService, useValue: userBranch },
        { provide: BranchQueryService, useValue: branchQuery },
        { provide: MovieOptionQueryService, useValue: movieQuery },
        { provide: RoomOptionQueryService, useValue: roomQuery },
      ],
    }).compile();
    service = moduleRef.get(ShowtimeFormOptionService);
  });

  describe('getManagerContext', () => {
    it('trả mã và tên chi nhánh', async () => {
      await expect(service.getManagerContext('mgr-a')).resolves.toEqual({
        branchId: 'branch-a',
        branchName: 'CGV Quận 1',
      });
    });

    it('chưa có chi nhánh -> 403', async () => {
      await expect(
        service.getManagerContext('mgr-none'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(branchQuery.getBranchSummary).not.toHaveBeenCalled();
    });

    it('chi nhánh không tồn tại -> 403', async () => {
      userBranch.getBranchIdOfUser.mockResolvedValue('branch-zzz');
      await expect(service.getManagerContext('mgr-a')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lỗi lạ -> 500 MSG_LOAD_FAILED', async () => {
      branchQuery.getBranchSummary.mockRejectedValue(new Error('down'));
      await expect(service.getManagerContext('mgr-a')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('searchMovieOptions', () => {
    it('truyền keyword/page/limit', async () => {
      const page = await service.searchMovieOptions('mgr-a', {
        keyword: 'dun',
        page: 2,
        limit: 5,
      });
      expect(movieQuery.searchMovieOptions).toHaveBeenCalledWith('dun', 2, 5);
      expect(page.items).toEqual([MOVIE]);
    });

    it('chưa có chi nhánh -> 403, không tìm phim', async () => {
      await expect(
        service.searchMovieOptions('mgr-none', { page: 1, limit: 10 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(movieQuery.searchMovieOptions).not.toHaveBeenCalled();
    });

    it('lỗi lạ -> 500', async () => {
      movieQuery.searchMovieOptions.mockRejectedValue(new Error('down'));
      await expect(
        service.searchMovieOptions('mgr-a', { page: 1, limit: 10 }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('listRoomOptions', () => {
    it('trả phòng theo chi nhánh của Manager', async () => {
      await expect(service.listRoomOptions('mgr-a')).resolves.toEqual(ROOMS);
      expect(roomQuery.listRoomsByBranch).toHaveBeenCalledWith('branch-a');
    });

    it('chưa có chi nhánh -> 403', async () => {
      await expect(service.listRoomOptions('mgr-none')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
