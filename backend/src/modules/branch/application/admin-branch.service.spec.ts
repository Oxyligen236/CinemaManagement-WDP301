import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BranchStatus, RoomStatus, SeatStatus, SeatType } from '@prisma/client';
import { AdminBranchService } from './admin-branch.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BRANCH_MESSAGES } from '../domain/branch.rules';

describe('AdminBranchService (Pattern B)', () => {
  let service: AdminBranchService;
  let mockPrisma: any;

  const mockBranch = {
    id: 'branch-1',
    branchName: 'Latte Cinema Landmark',
    address: 'Tòa Landmark 81, TP.HCM',
    hotline: '1900 2224',
    branchStatus: BranchStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      branch: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      room: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      seat: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      showtime: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBranchService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AdminBranchService>(AdminBranchService);
  });

  it('khởi tạo service thành công từ TestingModule', () => {
    expect(service).toBeDefined();
  });

  describe('createBranch (Tạo chi nhánh)', () => {
    it('tạo chi nhánh thành công khi thông tin hợp lệ', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      mockPrisma.branch.create.mockResolvedValue(mockBranch);

      const result = await service.createBranch({
        branchName: '  Latte Cinema Landmark  ',
        address: '  Tòa Landmark 81, TP.HCM  ',
        hotline: '1900 2224',
        branchStatus: BranchStatus.ACTIVE,
      });

      expect(mockPrisma.branch.findFirst).toHaveBeenCalledWith({
        where: {
          branchName: { equals: 'Latte Cinema Landmark', mode: 'insensitive' },
        },
      });

      expect(mockPrisma.branch.create).toHaveBeenCalledWith({
        data: {
          branchName: 'Latte Cinema Landmark',
          address: 'Tòa Landmark 81, TP.HCM',
          hotline: '1900 2224',
          branchStatus: BranchStatus.ACTIVE,
        },
      });

      expect(result.message).toBe(BRANCH_MESSAGES.MSG04_CREATED);
      expect(result.branch.branchId).toBe('branch-1');
      expect(result.branch.branchName).toBe('Latte Cinema Landmark');
    });

    it('tự động điền hotline mặc định 1900 2224 nếu không truyền hotline', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      mockPrisma.branch.create.mockResolvedValue({
        ...mockBranch,
        hotline: '1900 2224',
      });

      await service.createBranch({
        branchName: 'Latte Cinema Mỹ Đình',
        address: 'Hà Nội',
      });

      expect(mockPrisma.branch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hotline: '1900 2224',
          branchStatus: BranchStatus.ACTIVE,
        }),
      });
    });

    it('ném lỗi ConflictException (409) khi trùng tên chi nhánh', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);

      await expect(
        service.createBranch({
          branchName: 'LATTE CINEMA LANDMARK',
          address: 'Hà Nội',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.branch.create).not.toHaveBeenCalled();
    });
  });

  describe('listBranches (Danh sách & Thống kê toàn chuỗi)', () => {
    it('tính toán đúng chainStats và trả về danh sách chi nhánh', async () => {
      const branches = [
        { ...mockBranch, id: 'b-1', branchStatus: BranchStatus.ACTIVE },
        { ...mockBranch, id: 'b-2', branchName: 'Latte Cinema Cầu Giấy', branchStatus: BranchStatus.MAINTENANCE },
      ];

      mockPrisma.branch.findMany.mockResolvedValue(branches);

      // Giả lập 2 phòng cho branch b-1
      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'r-1', roomName: 'Phòng 1', roomStatus: RoomStatus.AVAILABLE, branchId: 'b-1' },
        { id: 'r-2', roomName: 'Phòng 2', roomStatus: RoomStatus.MAINTENANCE, branchId: 'b-1' },
      ]);

      // Giả lập ghế cho phòng r-1
      mockPrisma.seat.findMany.mockResolvedValue([
        { roomId: 'r-1', seatType: SeatType.STANDARD, status: SeatStatus.AVAILABLE },
        { roomId: 'r-1', seatType: SeatType.VIP, status: SeatStatus.AVAILABLE },
        { roomId: 'r-1', seatType: SeatType.STANDARD, status: SeatStatus.BROKEN },
      ]);

      const result = await service.listBranches({});

      expect(result.chainStats.totalBranches).toBe(2);
      expect(result.chainStats.activeBranches).toBe(1);
      expect(result.chainStats.maintenanceBranches).toBe(1);
      expect(result.chainStats.totalRooms).toBe(2);
      expect(result.chainStats.activeRooms).toBe(1);
      expect(result.chainStats.totalSeats).toBe(3);
      expect(result.chainStats.availableSeats).toBe(2);
      expect(result.branches.length).toBe(2);
    });

    it('lọc danh sách theo trạng thái branchStatus', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { ...mockBranch, id: 'b-1', branchStatus: BranchStatus.ACTIVE },
        { ...mockBranch, id: 'b-2', branchStatus: BranchStatus.INACTIVE },
      ]);

      const result = await service.listBranches({ branchStatus: BranchStatus.ACTIVE });
      expect(result.branches.length).toBe(1);
      expect(result.branches[0].branchId).toBe('b-1');
    });

    it('tìm kiếm theo từ khóa search (case-insensitive)', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { ...mockBranch, id: 'b-1', branchName: 'Latte Cinema Landmark', address: 'TP.HCM' },
        { ...mockBranch, id: 'b-2', branchName: 'Latte Cinema Thăng Long', address: 'Hà Nội' },
      ]);

      const result = await service.listBranches({ search: 'thăng long' });
      expect(result.branches.length).toBe(1);
      expect(result.branches[0].branchId).toBe('b-2');
    });
  });

  describe('getBranchDetail (Chi tiết chi nhánh)', () => {
    it('trả về thông tin chi nhánh và danh sách phòng', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(mockBranch);
      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'r-1', roomName: 'Screen 1', roomStatus: RoomStatus.AVAILABLE, branchId: 'branch-1' },
      ]);

      const result = await service.getBranchDetail('branch-1');

      expect(mockPrisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
      });
      expect(result.branch.branchId).toBe('branch-1');
      expect(result.branch.totalRooms).toBe(1);
      expect(result.rooms.length).toBe(1);
    });

    it('ném lỗi NotFoundException khi branchId không tồn tại', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.getBranchDetail('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBranch (Cập nhật chi nhánh)', () => {
    it('ném lỗi BadRequestException nếu body rỗng', async () => {
      await expect(service.updateBranch('branch-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ném lỗi NotFoundException nếu chi nhánh không tồn tại', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBranch('non-existent', { branchName: 'Tên mới' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném lỗi ConflictException khi đổi tên trùng với chi nhánh khác', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(mockBranch);
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: 'branch-2',
        branchName: 'Tên Đã Có',
      });

      await expect(
        service.updateBranch('branch-1', { branchName: 'Tên Đã Có' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.branch.update).not.toHaveBeenCalled();
    });

    it('chặn vô hiệu hóa (INACTIVE) nếu chi nhánh còn phòng đang hoạt động hoặc suất chiếu sắp tới', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        ...mockBranch,
        branchStatus: BranchStatus.ACTIVE,
      });

      // Còn 1 phòng đang available
      mockPrisma.room.findMany.mockResolvedValue([
        { id: 'r-1', roomName: 'Phòng 1', roomStatus: RoomStatus.AVAILABLE },
      ]);

      await expect(
        service.updateBranch('branch-1', { branchStatus: BranchStatus.INACTIVE }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.branch.update).not.toHaveBeenCalled();
    });

    it('cập nhật thành công khi dữ liệu hợp lệ', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(mockBranch);
      mockPrisma.branch.update.mockResolvedValue({
        ...mockBranch,
        branchName: 'Latte Cinema Landmark Updated',
        branchStatus: BranchStatus.MAINTENANCE,
      });

      const result = await service.updateBranch('branch-1', {
        branchName: 'Latte Cinema Landmark Updated',
        branchStatus: BranchStatus.MAINTENANCE,
      });

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: {
          branchName: 'Latte Cinema Landmark Updated',
          branchStatus: BranchStatus.MAINTENANCE,
        },
      });

      expect(result.message).toBe(BRANCH_MESSAGES.MSG03_UPDATED);
      expect(result.branch.branchName).toBe('Latte Cinema Landmark Updated');
    });
  });

  describe('deactivateBranch', () => {
    it('gọi hàm updateBranch chuyển trạng thái sang INACTIVE', async () => {
      // Mock không còn phòng active nào
      mockPrisma.branch.findUnique.mockResolvedValue({
        ...mockBranch,
        branchStatus: BranchStatus.ACTIVE,
      });
      mockPrisma.room.findMany.mockResolvedValue([]);
      mockPrisma.showtime.count.mockResolvedValue(0);
      mockPrisma.branch.update.mockResolvedValue({
        ...mockBranch,
        branchStatus: BranchStatus.INACTIVE,
      });

      const result = await service.deactivateBranch('branch-1');

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: { branchStatus: BranchStatus.INACTIVE },
      });
      expect(result.message).toBe(BRANCH_MESSAGES.MSG03_UPDATED);
    });
  });
});
