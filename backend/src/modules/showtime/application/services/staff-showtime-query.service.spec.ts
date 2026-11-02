import { ForbiddenException } from '@nestjs/common';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { StaffShowtimeQueryService } from './staff-showtime-query.service';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('StaffShowtimeQueryService', () => {
  const userBranchQueryService = { getBranchIdOfUser: jest.fn() };
  let mockPrisma: any;
  let service: StaffShowtimeQueryService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      branch: {
        findUnique: jest.fn(),
      },
      room: {
        findMany: jest.fn(),
      },
      showtime: {
        findMany: jest.fn(),
      },
      movie: {
        findMany: jest.fn(),
      },
      seatShowtime: {
        findMany: jest.fn(),
      },
      seat: {
        findMany: jest.fn(),
      },
    };

    service = new StaffShowtimeQueryService(
      userBranchQueryService as unknown as UserBranchQueryService,
      mockPrisma,
    );
  });

  it('throws ForbiddenException when staff has no active branch', async () => {
    userBranchQueryService.getBranchIdOfUser.mockResolvedValue(null);

    await expect(service.getStaffTodayShowtimes('staff-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockPrisma.room.findMany).not.toHaveBeenCalled();
  });

  it('only queries showtimes in rooms assigned to the staff branch', async () => {
    userBranchQueryService.getBranchIdOfUser.mockResolvedValue(
      'branch-cantavil',
    );
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'branch-cantavil',
      branchName: 'Cantavil',
    });
    mockPrisma.room.findMany.mockResolvedValue([
      {
        id: 'room-cantavil',
        roomName: 'Cinema 01',
        branchId: 'branch-cantavil',
        roomStatus: RoomStatus.AVAILABLE,
      },
    ]);
    const startTime = new Date();
    mockPrisma.showtime.findMany.mockResolvedValue([
      {
        id: 'showtime-1',
        movieId: 'movie-1',
        roomId: 'room-cantavil',
        startTime,
        endTime: new Date(startTime.getTime() + 7200000),
        basePrice: 75000,
      },
    ]);
    mockPrisma.movie.findMany.mockResolvedValue([
      {
        id: 'movie-1',
        movieName: 'Film title',
        posterKey: 'posters/film.jpg',
      },
    ]);
    mockPrisma.seatShowtime.findMany.mockResolvedValue([]);
    mockPrisma.seat.findMany.mockResolvedValue([]);

    const result = await service.getStaffTodayShowtimes('staff-1', startTime);

    expect(mockPrisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-cantavil',
        }),
      }),
    );
    expect(mockPrisma.showtime.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roomId: { in: ['room-cantavil'] },
        }),
      }),
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
