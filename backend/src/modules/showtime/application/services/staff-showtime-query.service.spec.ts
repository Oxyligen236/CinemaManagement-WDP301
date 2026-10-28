import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Branch } from '../../../branch/domain/schemas/branch.schema';
import { Movie } from '../../../movie/domain/schemas/movie.schema';
import { Room } from '../../../room/domain/schemas/room.schema';
import { Seat } from '../../../room/domain/schemas/seat.schema';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { SeatShowtime } from '../../domain/schemas/seat-showtime.schema';
import { Showtime } from '../../domain/schemas/showtime.schema';
import { StaffShowtimeQueryService } from './staff-showtime-query.service';

const queryChain = (result: unknown) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

describe('StaffShowtimeQueryService', () => {
  const userBranchQueryService = { getBranchIdOfUser: jest.fn() };
  const showtimeModel = { find: jest.fn() };
  const roomModel = { find: jest.fn() };
  const movieModel = { find: jest.fn() };
  const seatShowtimeModel = { find: jest.fn() };
  const seatModel = { find: jest.fn() };
  const branchModel = { findOne: jest.fn() };
  let service: StaffShowtimeQueryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffShowtimeQueryService,
        { provide: UserBranchQueryService, useValue: userBranchQueryService },
        { provide: getModelToken(Showtime.name), useValue: showtimeModel },
        { provide: getModelToken(Room.name), useValue: roomModel },
        { provide: getModelToken(Movie.name), useValue: movieModel },
        {
          provide: getModelToken(SeatShowtime.name),
          useValue: seatShowtimeModel,
        },
        { provide: getModelToken(Seat.name), useValue: seatModel },
        { provide: getModelToken(Branch.name), useValue: branchModel },
      ],
    }).compile();
    service = moduleRef.get(StaffShowtimeQueryService);
  });

  it('throws ForbiddenException when staff has no active branch', async () => {
    userBranchQueryService.getBranchIdOfUser.mockResolvedValue(null);

    await expect(service.getStaffTodayShowtimes('staff-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(roomModel.find).not.toHaveBeenCalled();
  });

  it('only queries showtimes in rooms assigned to the staff branch', async () => {
    userBranchQueryService.getBranchIdOfUser.mockResolvedValue(
      'branch-cantavil',
    );
    branchModel.findOne.mockReturnValue(
      queryChain({ branchId: 'branch-cantavil', branchName: 'Cantavil' }),
    );
    roomModel.find.mockReturnValue(
      queryChain([
        {
          roomId: 'room-cantavil',
          roomName: 'Cinema 01',
          branchId: 'branch-cantavil',
        },
      ]),
    );
    const startTime = new Date();
    showtimeModel.find.mockReturnValue(
      queryChain([
        {
          showtimeId: 'showtime-1',
          movieId: 'movie-1',
          roomId: 'room-cantavil',
          startTime,
          endTime: new Date(startTime.getTime() + 7200000),
          basePrice: 75000,
        },
      ]),
    );
    movieModel.find.mockReturnValue(
      queryChain([
        {
          movieId: 'movie-1',
          movieName: 'Film title',
          posterKey: 'posters/film.jpg',
        },
      ]),
    );
    seatShowtimeModel.find.mockReturnValue(queryChain([]));
    seatModel.find.mockReturnValue(queryChain([]));

    const result = await service.getStaffTodayShowtimes('staff-1', startTime);

    expect(roomModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-cantavil',
      }),
    );
    expect(showtimeModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: { $in: ['room-cantavil'] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      showtimeId: 'showtime-1',
      branchId: 'branch-cantavil',
      branchName: 'Cantavil',
      movieTitle: 'Film title',
    });
  });
});
