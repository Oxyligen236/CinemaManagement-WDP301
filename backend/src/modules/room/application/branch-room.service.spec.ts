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
        count: jest.fn().mockResolvedValue(12),
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
        findMany: jest.fn().mockResolvedValue([
          { id: 'r-1', roomName: 'Phòng 1', roomStatus: RoomStatus.AVAILABLE },
          { id: 'r-2', roomName: 'Phòng 2', roomStatus: RoomStatus.AVAILABLE },
        ]),
        create: jest.fn(),
      },
      seat: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
        count: jest.fn().mockResolvedValue(240),
      },
      showtime: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'st-1', roomId: 'r-1' },
          { id: 'st-2', roomId: 'r-2' },
        ]),
      },
      seatShowtime: {
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      workSchedule: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([]),
      },
      shiftAssignment: {
        count: jest.fn().mockResolvedValue(10),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([{ totalAmount: 25000000 }]),
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
            { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
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

      expect(mockPrisma.seat.deleteMany).toHaveBeenCalledWith({ where: { roomId: 'r-1' } });
      expect(mockPrisma.seat.createMany).toHaveBeenCalled();
      expect(mockPrisma.seatShowtime.deleteMany).toHaveBeenCalled();
      expect(result.message).toContain('thành công');
    });
  });

  describe('getManagerDashboardOverview', () => {
    it('trả về thông tin chi nhánh và KPI lấy từ cơ sở dữ liệu', async () => {
      const result = await service.getManagerDashboardOverview('mgr-1');

      expect(result.branch).toBeDefined();
      expect(result.branch.branchName).toBe('Latte Cinema Landmark');
      expect(result.kpi.rooms.totalRooms).toBe(2);
      expect(result.kpi.rooms.activeRooms).toBe(2);
      expect(result.kpi.rooms.totalSeats).toBe(240);
      expect(result.kpi.showtimes.todayCount).toBe(2);
      expect(result.kpi.staff.activeStaffCount).toBe(12);
      expect(result.kpi.staff.todayAssignedStaffCount).toBe(10);
      expect(result.kpi.revenue.todayRevenue).toBe(25000000);
    });
  });
});
