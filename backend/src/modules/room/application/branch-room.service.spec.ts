import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BranchRoomService } from './branch-room.service';
import {
  Role,
  BranchStatus,
  RoomStatus,
  SeatType,
  SeatStatus,
  SeatShowtimeStatus,
} from '@prisma/client';
import { ROOM_MESSAGES } from '../domain/room.rules';

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

      expect(mockPrisma.seat.deleteMany).toHaveBeenCalledWith({
        where: { roomId: 'r-1' },
      });
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

    it('xử lý khi phòng chiếu rỗng và có đơn hàng totalAmount null', async () => {
      mockPrisma.room.findMany.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([{ totalAmount: null }]);

      const result = await service.getManagerDashboardOverview('mgr-1');

      expect(result.kpi.rooms.totalRooms).toBe(0);
      expect(result.kpi.rooms.totalSeats).toBe(0);
      expect(result.kpi.showtimes.todayCount).toBe(0);
      expect(result.kpi.revenue.todayRevenue).toBe(0);
    });
  });

  describe('listRooms', () => {
    it('lấy danh sách phòng chiếu với bộ lọc roomStatus và search', async () => {
      mockPrisma.seat.findMany.mockResolvedValue([
        { roomId: 'r-1', seatType: SeatType.STANDARD, status: SeatStatus.AVAILABLE },
        { roomId: 'r-1', seatType: SeatType.VIP, status: SeatStatus.MAINTENANCE },
        { roomId: 'r-1', seatType: SeatType.COUPLE, status: SeatStatus.BLOCKED },
      ]);
      mockPrisma.showtime.findMany.mockResolvedValue([
        { roomId: 'r-1' },
        { roomId: 'r-1' },
      ]);

      const result = await service.listRooms('mgr-1', {
        roomStatus: RoomStatus.AVAILABLE,
        search: ' Phòng 1 ',
      });

      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: {
          branchId: 'b-1',
          roomStatus: RoomStatus.AVAILABLE,
          roomName: { contains: 'Phòng 1', mode: 'insensitive' },
        },
        orderBy: { roomName: 'asc' },
      });
      expect(result.total).toBe(2);
      expect(result.rooms[0]).toMatchObject({
        roomId: 'r-1',
        totalSeats: 3,
        availableSeats: 1,
        brokenSeats: 2,
        standardSeats: 1,
        vipSeats: 1,
        coupleSeats: 1,
        upcomingShowtimesCount: 2,
      });
    });

    it('trả về danh sách rỗng khi chi nhánh chưa có phòng chiếu', async () => {
      mockPrisma.room.findMany.mockResolvedValue([]);

      const result = await service.listRooms('mgr-1', {});

      expect(result.rooms).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockPrisma.seat.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getRoomDetail', () => {
    it('ném NotFoundException nếu phòng không tồn tại trong chi nhánh', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);

      await expect(service.getRoomDetail('mgr-1', 'r-missing')).rejects.toThrow(
        new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND),
      );
    });

    it('trả về chi tiết phòng kèm ghế bị khóa ở suất chiếu sắp tới và danh sách suất chiếu', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });
      mockPrisma.seat.findMany.mockResolvedValue([
        {
          id: 's-1',
          roomId: 'r-1',
          rowPosition: 'A',
          columnPosition: 1,
          seatType: SeatType.STANDARD,
          status: SeatStatus.AVAILABLE,
        },
        {
          id: 's-2',
          roomId: 'r-1',
          rowPosition: 'A',
          columnPosition: 2,
          seatType: SeatType.VIP,
          status: SeatStatus.MAINTENANCE,
        },
        {
          id: 's-3',
          roomId: 'r-1',
          rowPosition: 'B',
          columnPosition: 1,
          seatType: SeatType.COUPLE,
          status: SeatStatus.BLOCKED,
        },
      ]);
      mockPrisma.showtime.findMany
        .mockResolvedValueOnce([{ roomId: 'r-1' }])
        .mockResolvedValueOnce([{ id: 'st-1' }])
        .mockResolvedValueOnce([
          {
            id: 'st-1',
            movieId: 'm-1',
            movie: { id: 'm-1', movieName: 'Dune 2' },
            startTime: new Date('2026-12-01T10:00:00Z'),
            endTime: new Date('2026-12-01T12:30:00Z'),
          },
          {
            id: 'st-2',
            movieId: 'm-2',
            movie: null,
            startTime: new Date('2026-12-01T14:00:00Z'),
            endTime: new Date('2026-12-01T16:00:00Z'),
          },
        ]);
      mockPrisma.seatShowtime.findMany = jest
        .fn()
        .mockResolvedValue([{ seatId: 's-1' }]);

      const result = await service.getRoomDetail('mgr-1', 'r-1');

      expect(result.room.roomId).toBe('r-1');
      expect(result.seats[0]).toMatchObject({
        seatId: 's-1',
        isBroken: false,
        hasUpcomingBookedTicket: true,
      });
      expect(result.seats[1]).toMatchObject({
        seatId: 's-2',
        isBroken: true,
        hasUpcomingBookedTicket: false,
      });
      expect(result.seats[2].isBroken).toBe(true);
      expect(result.upcomingShowtimes).toHaveLength(2);
      expect(result.upcomingShowtimes[1].movieName).toBe('Phim đang xếp lịch');
    });

    it('trả về danh sách ghế khi không có suất chiếu sắp tới', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });
      mockPrisma.seat.findMany.mockResolvedValue([]);
      mockPrisma.showtime.findMany.mockResolvedValue([]);
      mockPrisma.seatShowtime.findMany = jest.fn();

      const result = await service.getRoomDetail('mgr-1', 'r-1');

      expect(result.seats).toEqual([]);
      expect(mockPrisma.seatShowtime.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createRoom default seats & validation', () => {
    it('ném ConflictException khi tên phòng đã tồn tại', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({ id: 'r-existing' });

      await expect(
        service.createRoom('mgr-1', { roomName: 'Phòng 1' }),
      ).rejects.toThrow(new ConflictException(ROOM_MESSAGES.ROOM_NAME_EXISTS));
    });

    it('sinh lưới ghế mặc định 6x10 khi không truyền customSeats/rowCount/columnsPerRow', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-default',
        roomName: 'Phòng Default',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });

      await service.createRoom('mgr-1', { roomName: 'Phòng Default' });

      const seatCreateCall = mockPrisma.seat.createMany.mock.calls[0][0];
      expect(seatCreateCall.data).toHaveLength(60);
      expect(seatCreateCall.data[0].seatType).toBe(SeatType.STANDARD);
      expect(seatCreateCall.data[30].seatType).toBe(SeatType.VIP);
      expect(seatCreateCall.data[50].seatType).toBe(SeatType.COUPLE);
    });

    it('sinh lưới ghế với rowCount nhỏ hơn 5 (không có hàng COUPLE) và custom rowCount > 26', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-small',
        roomName: 'Phòng Small',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });

      await service.createRoom('mgr-1', {
        roomName: 'Phòng Small',
        rowCount: 3,
        columnsPerRow: 4,
      });

      const seatCreateCall = mockPrisma.seat.createMany.mock.calls[0][0];
      expect(seatCreateCall.data).toHaveLength(12);
      expect(
        seatCreateCall.data.some((s: any) => s.seatType === SeatType.COUPLE),
      ).toBe(false);

      mockPrisma.seat.createMany.mockClear();
      await service.createRoom('mgr-1', {
        roomName: 'Phòng Big',
        rowCount: 27,
        columnsPerRow: 1,
      });
      const bigCall = mockPrisma.seat.createMany.mock.calls[0][0];
      expect(bigCall.data[26].rowPosition).toBe('R27');
    });

    it('bỏ qua createMany khi rowCount = 0', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-zero',
        roomName: 'Phòng Zero',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });

      await service.createRoom('mgr-1', {
        roomName: 'Phòng Zero',
        rowCount: 0,
        columnsPerRow: 4,
      });

      expect(mockPrisma.seat.createMany).not.toHaveBeenCalled();
    });
  });

  describe('replaceRoomLayout edge cases', () => {
    it('ném BadRequestException nếu chi nhánh không ACTIVE', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'b-1',
        branchName: 'Chi nhánh đóng',
        address: 'HN',
        branchStatus: BranchStatus.INACTIVE,
      });

      await expect(
        service.replaceRoomLayout('mgr-1', 'r-1', {
          seats: [
            { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
          ],
        }),
      ).rejects.toThrow(new BadRequestException(ROOM_MESSAGES.BRANCH_NOT_ACTIVE));
    });

    it('ném NotFoundException nếu không tìm thấy phòng khi replace layout', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);

      await expect(
        service.replaceRoomLayout('mgr-1', 'r-missing', {
          seats: [
            { rowPosition: 'A', columnPosition: 1, seatType: SeatType.STANDARD },
          ],
        }),
      ).rejects.toThrow(new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND));
    });

    it('thay layout thành công khi phòng không có suất chiếu sắp tới', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });
      mockPrisma.showtime.findMany.mockResolvedValue([]);

      const result = await service.replaceRoomLayout('mgr-1', 'r-1', {
        seats: [
          {
            rowPosition: ' a ',
            columnPosition: 1,
            seatType: SeatType.STANDARD,
            status: SeatStatus.BLOCKED,
          },
        ],
      });

      expect(mockPrisma.seatShowtime.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.seat.createMany).toHaveBeenCalledWith({
        data: [
          {
            roomId: 'r-1',
            rowPosition: 'A',
            columnPosition: 1,
            seatType: SeatType.STANDARD,
            status: SeatStatus.BLOCKED,
          },
        ],
      });
      expect(result.message).toBe(ROOM_MESSAGES.MSG08_LAYOUT_REPLACED);
    });
  });

  describe('updateRoom', () => {
    beforeEach(() => {
      mockPrisma.room.update = jest.fn().mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1 Mới',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });
      mockPrisma.showtime.count = jest.fn().mockResolvedValue(0);
    });

    it('ném BadRequestException nếu cả roomName và roomStatus đều undefined', async () => {
      await expect(service.updateRoom('mgr-1', 'r-1', {})).rejects.toThrow(
        new BadRequestException(ROOM_MESSAGES.MSG01_INVALID_INPUT),
      );
    });

    it('ném NotFoundException nếu không tìm thấy phòng', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRoom('mgr-1', 'r-missing', { roomName: 'Phòng X' }),
      ).rejects.toThrow(new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND));
    });

    it('ném ConflictException khi đổi sang tên phòng trùng trong chi nhánh', async () => {
      mockPrisma.room.findFirst
        .mockResolvedValueOnce({
          id: 'r-1',
          roomName: 'Phòng 1',
          roomStatus: RoomStatus.AVAILABLE,
          branchId: 'b-1',
        })
        .mockResolvedValueOnce({ id: 'r-2', roomName: 'Phòng 2' });

      await expect(
        service.updateRoom('mgr-1', 'r-1', { roomName: 'Phòng 2' }),
      ).rejects.toThrow(new ConflictException(ROOM_MESSAGES.ROOM_NAME_EXISTS));
    });

    it('ném ConflictException khi chuyển phòng sang MAINTENANCE mà còn suất chiếu sắp tới', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        roomStatus: RoomStatus.AVAILABLE,
        branchId: 'b-1',
      });
      mockPrisma.showtime.count.mockResolvedValue(2);

      await expect(
        service.updateRoom('mgr-1', 'r-1', {
          roomStatus: RoomStatus.MAINTENANCE as any,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cập nhật tên và trạng thái phòng thành công khi hợp lệ', async () => {
      mockPrisma.room.findFirst
        .mockResolvedValueOnce({
          id: 'r-1',
          roomName: 'Phòng 1',
          roomStatus: RoomStatus.AVAILABLE,
          branchId: 'b-1',
        })
        .mockResolvedValueOnce(null);
      mockPrisma.showtime.count.mockResolvedValue(0);

      const result = await service.updateRoom('mgr-1', 'r-1', {
        roomName: ' Phòng 1 Mới ',
        roomStatus: RoomStatus.MAINTENANCE as any,
      });

      expect(mockPrisma.room.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: {
          roomName: 'Phòng 1 Mới',
          roomStatus: RoomStatus.MAINTENANCE,
        },
      });
      expect(result.message).toBe(ROOM_MESSAGES.MSG04_ROOM_UPDATED);
    });

    it('cho phép giữ nguyên tên cũ (khác hoa thường) và bỏ qua check duplicate', async () => {
      mockPrisma.room.findFirst.mockResolvedValueOnce({
        id: 'r-1',
        roomName: 'Phòng 1',
        roomStatus: RoomStatus.MAINTENANCE,
        branchId: 'b-1',
      });

      await service.updateRoom('mgr-1', 'r-1', {
        roomName: 'phòng 1',
        roomStatus: RoomStatus.MAINTENANCE as any,
      });

      expect(mockPrisma.room.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.showtime.count).not.toHaveBeenCalled();
    });
  });

  describe('updateSeats', () => {
    beforeEach(() => {
      mockPrisma.seat.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.seatShowtime.findMany = jest.fn().mockResolvedValue([]);
    });

    it('ném BadRequestException nếu thiếu cả status và seatType', async () => {
      await expect(
        service.updateSeats('mgr-1', 'r-1', { seatIds: ['s-1'] }),
      ).rejects.toThrow(
        new BadRequestException(ROOM_MESSAGES.MSG01_INVALID_INPUT),
      );
    });

    it('ném NotFoundException nếu không tìm thấy phòng', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSeats('mgr-1', 'r-missing', {
          seatIds: ['s-1'],
          status: SeatStatus.AVAILABLE as any,
        }),
      ).rejects.toThrow(new NotFoundException(ROOM_MESSAGES.ROOM_NOT_FOUND));
    });

    it('ném NotFoundException nếu không tìm thấy ghế hợp lệ trong phòng', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        branchId: 'b-1',
      });
      mockPrisma.seat.findMany.mockResolvedValue([]);

      await expect(
        service.updateSeats('mgr-1', 'r-1', {
          seatIds: ['s-missing'],
          seatType: SeatType.VIP as any,
        }),
      ).rejects.toThrow(new NotFoundException(ROOM_MESSAGES.SEAT_NOT_FOUND));
    });

    it('ném ConflictException khi đánh dấu ghế MAINTENANCE/BLOCKED mà ghế đã bán trong suất chiếu sắp tới', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        branchId: 'b-1',
      });
      mockPrisma.seat.findMany.mockResolvedValue([
        { id: 's-1', rowPosition: 'A', columnPosition: 1 },
      ]);
      mockPrisma.showtime.findMany.mockResolvedValue([{ id: 'st-1' }]);
      mockPrisma.seatShowtime.findMany.mockResolvedValue([{ seatId: 's-1' }]);

      await expect(
        service.updateSeats('mgr-1', 'r-1', {
          seatIds: ['s-1'],
          status: SeatStatus.MAINTENANCE as any,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cập nhật ghế sang BLOCKED thành công khi không có vé đặt trong suất chiếu sắp tới', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        branchId: 'b-1',
      });
      mockPrisma.seat.findMany
        .mockResolvedValueOnce([
          { id: 's-1', rowPosition: 'A', columnPosition: 1 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 's-1',
            roomId: 'r-1',
            rowPosition: 'A',
            columnPosition: 1,
            seatType: SeatType.VIP,
            status: SeatStatus.BLOCKED,
          },
        ]);
      mockPrisma.showtime.findMany.mockResolvedValue([]);

      const result = await service.updateSeats('mgr-1', 'r-1', {
        seatIds: ['s-1'],
        status: SeatStatus.BLOCKED as any,
        seatType: SeatType.VIP as any,
      });

      expect(mockPrisma.seat.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['s-1'] } },
        data: { status: SeatStatus.BLOCKED, seatType: SeatType.VIP },
      });
      expect(result.updatedCount).toBe(1);
    });

    it('tái tạo seatShowtime bị thiếu khi khôi phục ghế về AVAILABLE', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'r-1',
        roomName: 'Phòng 1',
        branchId: 'b-1',
      });
      mockPrisma.seat.findMany
        .mockResolvedValueOnce([
          { id: 's-1', rowPosition: 'A', columnPosition: 1 },
          { id: 's-2', rowPosition: 'A', columnPosition: 2 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 's-1',
            roomId: 'r-1',
            rowPosition: 'A',
            columnPosition: 1,
            seatType: SeatType.STANDARD,
            status: SeatStatus.AVAILABLE,
          },
          {
            id: 's-2',
            roomId: 'r-1',
            rowPosition: 'A',
            columnPosition: 2,
            seatType: SeatType.STANDARD,
            status: SeatStatus.AVAILABLE,
          },
        ]);
      mockPrisma.showtime.findMany
        .mockResolvedValueOnce([{ id: 'st-1' }])
        .mockResolvedValue([])
        ;
      mockPrisma.seatShowtime.findMany.mockResolvedValueOnce([{ seatId: 's-1' }]);

      const result = await service.updateSeats('mgr-1', 'r-1', {
        seatIds: ['s-1', 's-2'],
        status: SeatStatus.AVAILABLE as any,
      });

      expect(mockPrisma.seatShowtime.createMany).toHaveBeenCalledWith({
        data: [
          {
            showtimeId: 'st-1',
            seatId: 's-2',
            seatStatus: SeatShowtimeStatus.EMPTY,
          },
        ],
      });
      expect(result.message).toBe(ROOM_MESSAGES.MSG04_SEATS_UPDATED);
    });
  });

  describe('resolveManagerBranch & guard', () => {
    it('ném ForbiddenException nếu user không phải MANAGER/BRANCHMANAGER hoặc bị khóa', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: Role.STAFF,
        isActive: true,
        branchId: 'b-1',
      });

      await expect(service.listRooms('u-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('chấp nhận role BRANCHMANAGER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'mgr-2',
        role: 'BRANCHMANAGER',
        isActive: true,
        branchId: 'b-1',
      });

      const result = await service.listRooms('mgr-2', {});
      expect(result.branch.branchId).toBe('b-1');
    });

    it('fallback sang defaultBranch hoặc tự tạo defaultBranch nếu không có managerUserId hoặc branch', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      mockPrisma.branch.create = jest.fn().mockResolvedValue({
        id: 'b-default',
        branchName: 'Lotte Cinema Nam Sài Gòn',
        address: 'Q7',
        branchStatus: BranchStatus.ACTIVE,
      });

      const result = await service.listRooms(undefined, {});

      expect(mockPrisma.branch.create).toHaveBeenCalled();
      expect(result.branch.branchId).toBe('b-default');
    });

    it('fallback sang defaultBranch có sẵn khi manager chưa có branchId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'mgr-no-branch',
        role: Role.MANAGER,
        isActive: true,
        branchId: null,
      });

      const result = await service.listRooms('mgr-no-branch', {});
      expect(result.branch.branchId).toBe('b-1');
    });

    it('chuyển lỗi hạ tầng không phải HttpException thành ServiceUnavailableException', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('db failure'));

      await expect(service.listRooms('mgr-1', {})).rejects.toThrow(
        new ServiceUnavailableException(ROOM_MESSAGES.SERVICE_UNAVAILABLE),
      );
    });
  });
});
