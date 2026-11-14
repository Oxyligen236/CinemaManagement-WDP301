import { ForbiddenException } from '@nestjs/common';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import { StaffShowtimeQueryService } from './staff-showtime-query.service';
import { RoomStatus, SeatShowtimeStatus, SeatStatus } from '@prisma/client';
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

  it('returns [] when branch has no available rooms', async () => {
    userBranchQueryService.getBranchIdOfUser.mockResolvedValue('b-1');
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'b-1',
      branchName: 'Branch 1',
    });
    mockPrisma.room.findMany.mockResolvedValue([]);

    await expect(service.getStaffTodayShowtimes('staff-1')).resolves.toEqual(
      [],
    );
    expect(mockPrisma.showtime.findMany).not.toHaveBeenCalled();
  });

  it('returns [] when there are no showtimes today', async () => {
    userBranchQueryService.getBranchIdOfUser.mockResolvedValue('b-1');
    mockPrisma.branch.findUnique.mockResolvedValue(null);
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'r-1', roomName: 'Room 1', branchId: 'b-1' },
    ]);
    mockPrisma.showtime.findMany.mockResolvedValue([]);

    await expect(service.getStaffTodayShowtimes('staff-1')).resolves.toEqual(
      [],
    );
    expect(mockPrisma.movie.findMany).not.toHaveBeenCalled();
  });

  it('computes seatShowtime stats, fallback seat stats, and poster URL variants', async () => {
    const prevStorage = process.env.STORAGE_PUBLIC_URL;
    process.env.STORAGE_PUBLIC_URL = 'https://cdn.example.com/';

    try {
      userBranchQueryService.getBranchIdOfUser.mockResolvedValue('b-1');
      mockPrisma.branch.findUnique.mockResolvedValue(null);
      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'r-1', roomName: 'Room 1', branchId: 'b-1' },
        { id: 'r-2', roomName: '', branchId: 'b-1' },
      ]);
      const startTime = new Date('2026-11-15T10:00:00Z');
      mockPrisma.showtime.findMany.mockResolvedValue([
        {
          id: 'st-1',
          movieId: 'm-1',
          roomId: 'r-1',
          startTime,
          endTime: new Date('2026-11-15T12:00:00Z'),
          basePrice: 80000,
        },
        {
          id: 'st-2',
          movieId: 'm-2',
          roomId: 'r-2',
          startTime,
          endTime: new Date('2026-11-15T12:00:00Z'),
          basePrice: 90000,
        },
      ]);
      mockPrisma.movie.findMany.mockResolvedValue([
        {
          id: 'm-1',
          movieName: 'Movie 1',
          posterKey: 'https://img.example.com/p1.jpg',
        },
      ]);
      mockPrisma.seatShowtime.findMany.mockResolvedValue([
        { showtimeId: 'st-1', seatStatus: SeatShowtimeStatus.EMPTY },
        { showtimeId: 'st-1', seatStatus: SeatShowtimeStatus.BOOKED },
      ]);
      mockPrisma.seat.findMany.mockResolvedValue([
        { roomId: 'r-2', status: SeatStatus.AVAILABLE },
        { roomId: 'r-2', status: SeatStatus.MAINTENANCE },
      ]);

      const result = await service.getStaffTodayShowtimes('staff-1', startTime);

      expect(result[0]).toMatchObject({
        showtimeId: 'st-1',
        moviePosterUrl: 'https://img.example.com/p1.jpg',
        availableSeats: 1,
        totalSeats: 2,
        branchName: '',
      });
      expect(result[1]).toMatchObject({
        showtimeId: 'st-2',
        movieTitle: 'Unknown',
        moviePosterUrl: null,
        roomName: 'Cinema',
        availableSeats: 1,
        totalSeats: 2,
      });
    } finally {
      if (prevStorage === undefined) delete process.env.STORAGE_PUBLIC_URL;
      else process.env.STORAGE_PUBLIC_URL = prevStorage;
    }
  });
});
