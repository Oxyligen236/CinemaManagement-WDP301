import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BranchRoomService } from './branch-room.service';
import { User } from '../../user/domain/schemas/user.schema';
import { Branch } from '../../branch/domain/schemas/branch.schema';
import { Room } from '../domain/schemas/room.schema';
import { Seat } from '../domain/schemas/seat.schema';
import { Showtime } from '../../showtime/domain/schemas/showtime.schema';
import { SeatShowtime } from '../../showtime/domain/schemas/seat-showtime.schema';
import { Movie } from '../../movie/domain/schemas/movie.schema';
import { Role } from '../../user/domain/enums/role.enum';
import { BranchStatus } from '../../branch/domain/enums/branch-status.enum';
import { RoomStatus } from '../domain/enums/room-status.enum';
import { SeatType } from '../domain/enums/seat-type.enum';
import { SeatStatus } from '../domain/enums/seat-status.enum';
import { SeatShowtimeStatus } from '../../showtime/domain/enums/seat-showtime-status.enum';

const chain = (result: unknown) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

describe('BranchRoomService - Layout Designer & Custom Seats', () => {
  let service: BranchRoomService;

  const mockUserModel = {
    findOne: jest.fn(),
  };

  const mockBranchModel = {
    findOne: jest.fn(),
  };

  const mockRoomModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    exists: jest.fn(),
  };

  const mockSeatModel = {
    find: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockShowtimeModel = {
    find: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockSeatShowtimeModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
  };

  const mockMovieModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchRoomService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Branch.name), useValue: mockBranchModel },
        { provide: getModelToken(Room.name), useValue: mockRoomModel },
        { provide: getModelToken(Seat.name), useValue: mockSeatModel },
        { provide: getModelToken(Showtime.name), useValue: mockShowtimeModel },
        { provide: getModelToken(SeatShowtime.name), useValue: mockSeatShowtimeModel },
        { provide: getModelToken(Movie.name), useValue: mockMovieModel },
      ],
    }).compile();

    service = moduleRef.get<BranchRoomService>(BranchRoomService);

    // Mock active branch manager
    mockUserModel.findOne.mockReturnValue(
      chain({
        userId: 'mgr-1',
        role: Role.BRANCHMANAGER,
        isActive: true,
        branchId: 'b-1',
      }),
    );

    mockBranchModel.findOne.mockReturnValue(
      chain({
        branchId: 'b-1',
        branchName: 'Latte Cinema Landmark',
        branchStatus: BranchStatus.ACTIVE,
      }),
    );

    mockSeatModel.aggregate.mockResolvedValue([]);
    mockShowtimeModel.aggregate.mockResolvedValue([]);
  });

  describe('createRoom with customSeats', () => {
    it('tạo phòng chiếu mới với sơ đồ ghế tùy biến thay vì sơ đồ mặc định', async () => {
      mockRoomModel.exists.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockRoomModel.create.mockResolvedValue({
        roomId: 'room-new-1',
        roomName: 'Phòng 10 IMAX Laser',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
        toObject: () => ({
          roomId: 'room-new-1',
          roomName: 'Phòng 10 IMAX Laser',
          roomStatus: RoomStatus.AVAILABLE,
          branchId: 'b-1',
        }),
      });

      mockSeatModel.insertMany.mockResolvedValue([]);

      const customSeats = [
        { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
        { rowPosition: 'A', columnPosition: 2, seatType: SeatType.STANDARD },
        { rowPosition: 'A', columnPosition: 4, seatType: SeatType.STANDARD }, // aisle at col 3
        { rowPosition: 'B', columnPosition: 1, seatType: SeatType.VIP },
        { rowPosition: 'C', columnPosition: 1, seatType: SeatType.COUPLE },
      ];

      const result = await service.createRoom('mgr-1', {
        roomName: 'Phòng 10 IMAX Laser',
        customSeats,
      });

      expect(mockRoomModel.create).toHaveBeenCalledWith({
        roomName: 'Phòng 10 IMAX Laser',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });

      expect(mockSeatModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            roomId: 'room-new-1',
            rowPosition: 'A',
            columnPosition: 1,
            seatType: SeatType.STANDARD,
          }),
          expect.objectContaining({
            roomId: 'room-new-1',
            rowPosition: 'B',
            columnPosition: 1,
            seatType: SeatType.VIP,
          }),
        ]),
        { ordered: false },
      );

      expect(result.message).toContain('thành công');
    });
  });

  describe('replaceRoomLayout', () => {
    it('chặn thay đổi layout và ném ConflictException nếu phòng đang có suất chiếu đã bán vé', async () => {
      mockRoomModel.findOne.mockReturnValue(
        chain({
          roomId: 'r-1',
          roomName: 'Phòng 1',
          branchId: 'b-1',
        }),
      );

      // Suất chiếu sắp diễn ra
      mockShowtimeModel.find.mockReturnValue(
        chain([{ showtimeId: 'st-upcoming-1' }]),
      );

      // Đã có vé bán
      mockSeatShowtimeModel.countDocuments.mockResolvedValue(2);

      await expect(
        service.replaceRoomLayout('mgr-1', 'r-1', {
          seats: [
            { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
          ],
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockSeatModel.deleteMany).not.toHaveBeenCalled();
    });

    it('thay thế sơ đồ ghế thành công và tái tạo seatShowtime khi phòng chưa có vé nào bán', async () => {
      mockRoomModel.findOne.mockReturnValue(
        chain({
          roomId: 'r-1',
          roomName: 'Phòng 1',
          branchId: 'b-1',
        }),
      );

      // Suất chiếu sắp diễn ra nhưng CHƯA bán vé
      mockShowtimeModel.find.mockReturnValue(
        chain([{ showtimeId: 'st-upcoming-1' }]),
      );
      mockSeatShowtimeModel.countDocuments.mockResolvedValue(0);

      mockSeatShowtimeModel.deleteMany.mockResolvedValue({ deletedCount: 10 });
      mockSeatModel.deleteMany.mockResolvedValue({ deletedCount: 50 });

      const newSeats = [
        {
          seatId: 'seat-new-1',
          roomId: 'r-1',
          rowPosition: 'A',
          columnPosition: 1,
          seatType: SeatType.STANDARD,
          status: SeatStatus.AVAILABLE,
        },
        {
          seatId: 'seat-new-2',
          roomId: 'r-1',
          rowPosition: 'A',
          columnPosition: 2,
          seatType: SeatType.VIP,
          status: SeatStatus.AVAILABLE,
        },
      ];

      mockSeatModel.insertMany.mockResolvedValue(newSeats);
      mockSeatShowtimeModel.insertMany.mockResolvedValue([]);

      const result = await service.replaceRoomLayout('mgr-1', 'r-1', {
        seats: [
          { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
          { rowPosition: 'A', columnPosition: 2, seatType: SeatType.VIP },
        ],
      });

      // Verify old seats deleted
      expect(mockSeatModel.deleteMany).toHaveBeenCalledWith({ roomId: 'r-1' });

      // Verify new seats inserted
      expect(mockSeatModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            roomId: 'r-1',
            rowPosition: 'A',
            columnPosition: 1,
            seatType: SeatType.STANDARD,
          }),
        ]),
        { ordered: false },
      );

      // Verify old seatShowtimes deleted and recreated for upcoming showtimes
      expect(mockSeatShowtimeModel.deleteMany).toHaveBeenCalledWith({
        showtimeId: { $in: ['st-upcoming-1'] },
      });
      expect(mockSeatShowtimeModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            showtimeId: 'st-upcoming-1',
            seatId: 'seat-new-1',
            seatStatus: SeatShowtimeStatus.EMPTY,
          }),
        ]),
        { ordered: false },
      );

      expect(result.message).toContain('thành công');
    });
  });
});
