import { Test, TestingModule } from '@nestjs/testing';
import { ManagerDashboardController } from './manager-dashboard.controller';
import { BranchRoomService } from '../application/branch-room.service';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

describe('ManagerDashboardController (Pattern B)', () => {
  let controller: ManagerDashboardController;
  let branchRoomService: Partial<Record<keyof BranchRoomService, jest.Mock>>;
  let jwtService: Partial<Record<keyof JwtService, jest.Mock>>;

  const mockOverviewData = {
    branch: {
      id: 'branch-1',
      branchName: 'Latte Cinema Landmark',
      address: 'TP.HCM',
    },
    roomsCount: 4,
    seatsCount: 360,
    todayShowtimesCount: 12,
    activeStaffCount: 8,
    todayRevenue: 15400000,
  };

  beforeEach(async () => {
    branchRoomService = {
      getManagerDashboardOverview: jest.fn(),
    };

    jwtService = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManagerDashboardController],
      providers: [
        {
          provide: BranchRoomService,
          useValue: branchRoomService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    controller = module.get<ManagerDashboardController>(ManagerDashboardController);
  });

  it('khởi tạo controller thành công từ TestingModule', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboardOverview (GET /manager/dashboard/overview)', () => {
    it('giải mã Bearer token hợp lệ và chuyển đúng managerUserId vào service', async () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      } as unknown as Request;

      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'mgr-123', email: 'manager@latte.vn' });
      (branchRoomService.getManagerDashboardOverview as jest.Mock).mockResolvedValue(mockOverviewData);

      const result = await controller.getDashboardOverview(mockReq);

      expect(jwtService.verify).toHaveBeenCalledWith('valid.jwt.token');
      expect(branchRoomService.getManagerDashboardOverview).toHaveBeenCalledWith('mgr-123');
      expect(result).toEqual(mockOverviewData);
    });

    it('gọi service với userId = undefined khi không có header Authorization', async () => {
      const mockReq = {
        headers: {},
      } as unknown as Request;

      (branchRoomService.getManagerDashboardOverview as jest.Mock).mockResolvedValue(mockOverviewData);

      const result = await controller.getDashboardOverview(mockReq);

      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(branchRoomService.getManagerDashboardOverview).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockOverviewData);
    });

    it('gọi service với userId = undefined khi token không đúng định dạng Bearer', async () => {
      const mockReq = {
        headers: {
          authorization: 'Basic abcxyz',
        },
      } as unknown as Request;

      (branchRoomService.getManagerDashboardOverview as jest.Mock).mockResolvedValue(mockOverviewData);

      const result = await controller.getDashboardOverview(mockReq);

      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(branchRoomService.getManagerDashboardOverview).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockOverviewData);
    });

    it('gọi service với userId = undefined khi jwtService.verify ném ngoại lệ (token hết hạn)', async () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer expired.jwt.token',
        },
      } as unknown as Request;

      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });
      (branchRoomService.getManagerDashboardOverview as jest.Mock).mockResolvedValue(mockOverviewData);

      const result = await controller.getDashboardOverview(mockReq);

      expect(jwtService.verify).toHaveBeenCalledWith('expired.jwt.token');
      expect(branchRoomService.getManagerDashboardOverview).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockOverviewData);
    });
  });

  describe('getDashboard (GET /manager/dashboard)', () => {
    it('gọi đúng hàm getManagerDashboardOverview tương tự route overview', async () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer token-abc',
        },
      } as unknown as Request;

      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'mgr-456' });
      (branchRoomService.getManagerDashboardOverview as jest.Mock).mockResolvedValue(mockOverviewData);

      const result = await controller.getDashboard(mockReq);

      expect(branchRoomService.getManagerDashboardOverview).toHaveBeenCalledWith('mgr-456');
      expect(result).toEqual(mockOverviewData);
    });
  });
});
