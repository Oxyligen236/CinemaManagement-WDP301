import { Test, TestingModule } from '@nestjs/testing';
import { AdminBranchController } from './admin-branch.controller';
import { AdminBranchService } from '../application/admin-branch.service';
import { BranchQueryService } from '../application/services/branch-query.service';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { BranchStatus } from '@prisma/client';
import { CreateBranchDto, UpdateBranchDto } from '../application/dto/req.dto';

describe('AdminBranchController (Pattern B)', () => {
  let controller: AdminBranchController;
  let adminBranchService: Partial<Record<keyof AdminBranchService, jest.Mock>>;
  let branchQueryService: Partial<Record<keyof BranchQueryService, jest.Mock>>;

  beforeEach(async () => {
    adminBranchService = {
      listBranches: jest.fn(),
      getBranchDetail: jest.fn(),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deactivateBranch: jest.fn(),
      listPublicBranches: jest.fn(),
    };

    branchQueryService = {
      getPublicBranches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBranchController],
      providers: [
        {
          provide: AdminBranchService,
          useValue: adminBranchService,
        },
        {
          provide: BranchQueryService,
          useValue: branchQueryService,
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminBranchController>(AdminBranchController);
  });

  it('khởi tạo controller thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('createBranch', () => {
    it('gọi adminBranchService.createBranch với đúng input DTO', async () => {
      const input: CreateBranchDto = {
        branchName: 'Latte Cinema Landmark',
        address: 'Tòa nhà Landmark 81, TP.HCM',
        hotline: '1900 2224',
        branchStatus: BranchStatus.ACTIVE,
      };

      const mockResponse = {
        message: 'Tạo chi nhánh thành công',
        branch: { id: 'b-1', ...input },
      };

      (adminBranchService.createBranch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.createBranch(input);

      expect(adminBranchService.createBranch).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listAdminBranches', () => {
    it('chuyển đúng query parameters vào adminBranchService.listBranches', async () => {
      const query = {
        search: 'Landmark',
        branchStatus: BranchStatus.ACTIVE,
      };

      const mockListResult = {
        chainStats: {
          totalBranches: 1,
          activeBranches: 1,
          maintenanceBranches: 0,
          inactiveBranches: 0,
          totalRooms: 3,
          activeRooms: 3,
          totalSeats: 300,
          availableSeats: 300,
        },
        branches: [{ id: 'b-1', branchName: 'Latte Cinema Landmark' }],
      };

      (adminBranchService.listBranches as jest.Mock).mockResolvedValue(mockListResult);

      const result = await controller.listAdminBranches(query);

      expect(adminBranchService.listBranches).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockListResult);
    });
  });

  describe('getAdminBranchDetail', () => {
    it('gọi adminBranchService.getBranchDetail với đúng branchId', async () => {
      const branchId = 'b-1';
      const mockDetail = {
        id: branchId,
        branchName: 'Latte Cinema Landmark',
        rooms: [],
      };

      (adminBranchService.getBranchDetail as jest.Mock).mockResolvedValue(mockDetail);

      const result = await controller.getAdminBranchDetail(branchId);

      expect(adminBranchService.getBranchDetail).toHaveBeenCalledWith(branchId);
      expect(result).toEqual(mockDetail);
    });
  });

  describe('updateBranch', () => {
    it('gọi adminBranchService.updateBranch với branchId và input', async () => {
      const branchId = 'b-1';
      const input: UpdateBranchDto = {
        branchName: 'Latte Cinema Landmark Updated',
        branchStatus: BranchStatus.MAINTENANCE,
      };

      const mockUpdateResponse = {
        message: 'Cập nhật chi nhánh thành công',
        branch: { id: branchId, ...input },
      };

      (adminBranchService.updateBranch as jest.Mock).mockResolvedValue(mockUpdateResponse);

      const result = await controller.updateBranch(branchId, input);

      expect(adminBranchService.updateBranch).toHaveBeenCalledWith(branchId, input);
      expect(result).toEqual(mockUpdateResponse);
    });
  });

  describe('deactivateBranch', () => {
    it('gọi adminBranchService.deactivateBranch với branchId', async () => {
      const branchId = 'b-1';
      const mockDeactivateResponse = {
        message: 'Chi nhánh đã được vô hiệu hóa thành công',
        branch: { id: branchId, branchStatus: BranchStatus.INACTIVE },
      };

      (adminBranchService.deactivateBranch as jest.Mock).mockResolvedValue(mockDeactivateResponse);

      const result = await controller.deactivateBranch(branchId);

      expect(adminBranchService.deactivateBranch).toHaveBeenCalledWith(branchId);
      expect(result).toEqual(mockDeactivateResponse);
    });
  });

  describe('listPublicBranchesCompact', () => {
    it('gọi branchQueryService.getPublicBranches với query', async () => {
      const query = { search: 'Hà Nội' };
      const mockBranches = [{ id: 'b-2', name: 'Latte Cinema Cầu Giấy' }];

      (branchQueryService.getPublicBranches as jest.Mock).mockResolvedValue(mockBranches);

      const result = await controller.listPublicBranchesCompact(query);

      expect(branchQueryService.getPublicBranches).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockBranches);
    });
  });

  describe('listPublicBranches & getPublicBranchDetail', () => {
    it('gọi adminBranchService.listPublicBranches', async () => {
      (adminBranchService.listPublicBranches as jest.Mock).mockResolvedValue([]);
      const result = await controller.listPublicBranches('Landmark');
      expect(adminBranchService.listPublicBranches).toHaveBeenCalledWith('Landmark');
      expect(result).toEqual([]);
    });

    it('gọi adminBranchService.getBranchDetail qua public route', async () => {
      const mockDetail = { id: 'b-1', branchName: 'Latte Cinema' };
      (adminBranchService.getBranchDetail as jest.Mock).mockResolvedValue(mockDetail);
      const result = await controller.getPublicBranchDetail('b-1');
      expect(adminBranchService.getBranchDetail).toHaveBeenCalledWith('b-1');
      expect(result).toEqual(mockDetail);
    });
  });
});
