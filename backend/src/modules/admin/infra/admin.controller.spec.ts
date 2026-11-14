import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedRequest, AuthUser } from '../../auth/domain/auth-user';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Role } from '../../user/domain/enums/role.enum';
import { AdminService } from '../application/admin.service';
import {
  AssignBranchDto,
  CreateUserDto,
  ManageUsersQueryDto,
  UpdateUserDto,
} from '../application/dto/manage-user.dto';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: {
    getDashboard: jest.Mock;
    getUsers: jest.Mock;
    getActiveBranches: jest.Mock;
    getUser: jest.Mock;
    assignBranch: jest.Mock;
    createUser: jest.Mock;
    updateUser: jest.Mock;
  };

  const authUser: AuthUser = {
    sub: 'admin-1',
    email: 'admin@cinema.local',
    role: Role.ADMIN,
    tokenVersion: 0,
  };
  const req = { user: authUser } as AuthenticatedRequest;

  beforeEach(async () => {
    adminService = {
      getDashboard: jest.fn(),
      getUsers: jest.fn(),
      getActiveBranches: jest.fn(),
      getUser: jest.fn(),
      assignBranch: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: adminService }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AdminController);
  });

  it('getDashboard delegates authenticated user to AdminService', async () => {
    const expected = { message: 'Welcome back' };
    adminService.getDashboard.mockResolvedValue(expected);

    const result = await controller.getDashboard(req);

    expect(adminService.getDashboard).toHaveBeenCalledWith(authUser);
    expect(result).toBe(expected);
  });

  it('getUsers delegates query filters to AdminService', async () => {
    const query: ManageUsersQueryDto = {
      search: 'minh',
      role: Role.STAFF,
      isActive: true,
    };
    const expected = { users: [], total: 0 };
    adminService.getUsers.mockResolvedValue(expected);

    const result = await controller.getUsers(query);

    expect(adminService.getUsers).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('getActiveBranches delegates to AdminService', async () => {
    const expected = { branches: [] };
    adminService.getActiveBranches.mockResolvedValue(expected);

    const result = await controller.getActiveBranches();

    expect(adminService.getActiveBranches).toHaveBeenCalledTimes(1);
    expect(result).toBe(expected);
  });

  it('getUser delegates userId param to AdminService', async () => {
    const expected = { user: { userId: 'u-1' } };
    adminService.getUser.mockResolvedValue(expected);

    const result = await controller.getUser('u-1');

    expect(adminService.getUser).toHaveBeenCalledWith('u-1');
    expect(result).toBe(expected);
  });

  it('assignBranch delegates userId, input, and admin sub to AdminService', async () => {
    const dto: AssignBranchDto = { branchId: 'branch-1' };
    const expected = { message: 'ok', user: { userId: 'u-1' } };
    adminService.assignBranch.mockResolvedValue(expected);

    const result = await controller.assignBranch('u-1', dto, req);

    expect(adminService.assignBranch).toHaveBeenCalledWith(
      'u-1',
      dto,
      'admin-1',
    );
    expect(result).toBe(expected);
  });

  it('createUser delegates input body to AdminService', async () => {
    const dto: CreateUserDto = {
      email: 'staff@cinema.local',
      password: 'Password123!',
      firstName: 'Minh',
      lastName: 'Nguyen',
      role: Role.STAFF,
    };
    const expected = { message: 'created', user: { userId: 'u-2' } };
    adminService.createUser.mockResolvedValue(expected);

    const result = await controller.createUser(dto);

    expect(adminService.createUser).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('updateUser delegates userId, input, and admin sub to AdminService', async () => {
    const dto: UpdateUserDto = { firstName: 'Updated' };
    const expected = { message: 'updated', user: { userId: 'u-1' } };
    adminService.updateUser.mockResolvedValue(expected);

    const result = await controller.updateUser('u-1', dto, req);

    expect(adminService.updateUser).toHaveBeenCalledWith('u-1', dto, 'admin-1');
    expect(result).toBe(expected);
  });
});
