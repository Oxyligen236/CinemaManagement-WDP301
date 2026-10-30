import { ConflictException } from '@nestjs/common';
import { BranchRoomService } from './branch-room.service';
import {
  Role,
  BranchStatus,
  RoomStatus,
  SeatType,
  SeatStatus,
  SeatShowtimeStatus,
} from '@prisma/client';

describe('BranchRoomService - Layout Designer & Custom Seats', () => {
  let service: BranchRoomService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mgr-1',
          role: Role.MANAGER,
          isActive: true,
          branchId: 'b-1',
        }),
      },
      branch: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b-1',
          branchName: 'Latte Cinema Landmark',
          branchStatus: BranchStatus.ACTIVE,
          address: 'Hà Nội',
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'b-1',
          branchName: 'Latte Cinema Landmark',
          branchStatus: BranchStatus.ACTIVE,
          address: 'Hà Nội',
        }),
      },
      room: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      seat: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
      },
      showtime: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      seatShowtime: {
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    service = new BranchRoomService(mockPrisma);
  });

  describe('createRoom with customSeats', () => {
    it('tạo phòng chiếu mới với sơ đồ ghế tùy biến thay vì sơ đồ mặc định', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-new-1',
        roomName: 'Phòng 10 IMAX Laser',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });

      const customSeats = [
        { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
        { rowPosition: 'A', columnPosition: 2, seatType: SeatType.STANDARD },
        { rowPosition: 'A', columnPosition: 4, seatType: SeatType.STANDARD },
        { rowPosition: 'B', columnPosition: 1, seatType: SeatType.VIP },
        { rowPosition: 'C', columnPosition: 1, seatType: SeatType.COUPLE },
      ];

      const result = await service.createRoom('mgr-1', {
        roomName: 'Phòng 10 IMAX Laser',
        customSeats,
      });

      expect(mockPrisma.room.create).toHaveBeenCalledWith({
        data: {
          roomName: 'Phòng 10 IMAX Laser',
          roomStatus: RoomStatus.AVAILABLE,
          branchId: 'b-1',
        },
      });

      expect(mockPrisma.seat.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
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
      });

      expect(result.message).toContain('thành công');
    });
  });

  describe('replaceRoomLayout', () => {
    it('chặn thay đổi layout và ném ConflictException nếu phòng đang có suất chiếu đã bán vé', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        branchId: 'b-1',
      });

      // Suất chiếu sắp diễn ra
      mockPrisma.showtime.findMany.mockResolvedValue([{ id: 'st-upcoming-1' }]);

      // Đã có vé bán
      mockPrisma.seatShowtime.count.mockResolvedValue(2);

      await expect(
        service.replaceRoomLayout('mgr-1', 'r-1', {
          seats: [
            {
              rowPosition: 'A',
              columnPosition: 1,
              seatType: SeatType.STANDARD,
            },
          ],
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.seat.deleteMany).not.toHaveBeenCalled();
    });

    it('thay thế sơ đồ ghế thành công và tái tạo seatShowtime khi phòng chưa có vé nào bán', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        branchId: 'b-1',
      });

      // Suất chiếu sắp diễn ra nhưng CHƯA bán vé
      mockPrisma.showtime.findMany.mockResolvedValue([{ id: 'st-upcoming-1' }]);
      mockPrisma.seatShowtime.count.mockResolvedValue(0);

      mockPrisma.seatShowtime.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.seat.deleteMany.mockResolvedValue({ count: 50 });

      const newSeats = [
        {
          id: 'seat-new-1',
          roomId: 'r-1',
          rowPosition: 'A',
          columnPosition: 1,
          seatType: SeatType.STANDARD,
          status: SeatStatus.AVAILABLE,
        },
        {
          id: 'seat-new-2',
          roomId: 'r-1',
          rowPosition: 'A',
          columnPosition: 2,
          seatType: SeatType.VIP,
          status: SeatStatus.AVAILABLE,
        },
      ];

      mockPrisma.seat.findMany.mockResolvedValue(newSeats);

      const result = await service.replaceRoomLayout('mgr-1', 'r-1', {
        seats: [
          { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
          { rowPosition: 'A', columnPosition: 2, seatType: SeatType.VIP },
        ],
      });

      // Verify old seats deleted
      expect(mockPrisma.seat.deleteMany).toHaveBeenCalledWith({
        where: { roomId: 'r-1' },
      });

      // Verify new seats inserted
      expect(mockPrisma.seat.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            roomId: 'r-1',
            rowPosition: 'A',
            columnPosition: 1,
            seatType: SeatType.STANDARD,
          }),
        ]),
      });

      // Verify old seatShowtimes deleted and recreated for upcoming showtimes
      expect(mockPrisma.seatShowtime.deleteMany).toHaveBeenCalledWith({
        where: { showtimeId: { in: ['st-upcoming-1'] } },
      });
      expect(mockPrisma.seatShowtime.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            showtimeId: 'st-upcoming-1',
            seatId: 'seat-new-1',
            seatStatus: SeatShowtimeStatus.EMPTY,
          }),
        ]),
      });

      expect(result.message).toContain('thành công');
    });
  });
});
