import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { BranchStatus, Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthUser } from '../../auth/domain/auth-user';
import { Role as DomainRole } from '../../user/domain/enums/role.enum';
import { REGISTRATION_MESSAGES } from '../../user/domain/constants/auth-message.constants';

type UpdateCall = {
  where: { id: string };
  data: Record<string, unknown>;
};

const buildService = (stored: Partial<any> = {}) => {
  const calls: UpdateCall[] = [];
  const updated = {
    id: 'u-1',
    email: 'staff@cinema.local',
    firstName: 'Minh',
    lastName: 'Nguyen',
    role: Role.USER,
    isActive: true,
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u-1',
        role: Role.STAFF,
        branchId: 'b-1',
        isActive: true,
        ...stored,
      }),
      update: jest.fn((args: UpdateCall) => {
        calls.push(args);
        return Promise.resolve(updated);
      }),
    },
  };

  return {
    service: new AdminService(mockPrisma as unknown as PrismaService),
    calls,
  };
};

describe('AdminService.updateUser (branch cleanup on role change)', () => {
  it('unsets branchId when a staff account becomes a customer', async () => {
    const { service, calls } = buildService();

    await service.updateUser('u-1', { role: Role.USER as any }, 'admin-1');

    expect(calls).toHaveLength(1);
    expect(calls[0].data.branchId).toBeNull();
  });

  it('unsets branchId when a manager becomes a customer', async () => {
    const { service, calls } = buildService({ role: Role.MANAGER });

    await service.updateUser('u-1', { role: Role.USER as any }, 'admin-1');

    expect(calls[0].data.branchId).toBeNull();
  });

  it('keeps branchId when the new role still works at a branch', async () => {
    const { service, calls } = buildService();

    await service.updateUser('u-1', { role: Role.MANAGER as any }, 'admin-1');

    expect(calls[0].data.branchId).toBeUndefined();
    expect(calls[0].data.role).toEqual(Role.MANAGER);
  });

  it('keeps branchId when the update does not touch the role', async () => {
    const { service, calls } = buildService();

    await service.updateUser('u-1', { firstName: 'Khanh' }, 'admin-1');

    expect(calls[0].data.branchId).toBeUndefined();
    expect(calls[0].data.firstName).toEqual('Khanh');
  });

  it('still bumps tokenVersion when deactivating alongside a demotion', async () => {
    const { service, calls } = buildService();

    await service.updateUser(
      'u-1',
      { role: Role.USER as any, isActive: false },
      'admin-1',
    );

    expect(calls[0].data.branchId).toBeNull();
    expect(calls[0].data.tokenVersion).toEqual({ increment: 1 });
  });
});

describe('AdminService.updateUser (bảo vệ tài khoản quản trị viên)', () => {
  it('chặn admin cập nhật tài khoản quản trị viên khác', async () => {
    const { service, calls } = buildService({
      id: 'admin-2',
      role: Role.ADMIN,
    });

    await expect(
      service.updateUser('admin-2', { firstName: 'Khanh' }, 'admin-1'),
    ).rejects.toThrow('Không thể cập nhật tài khoản quản trị viên khác');
    expect(calls).toHaveLength(0);
  });

  it('chặn admin hạ vai trò của một quản trị viên khác', async () => {
    const { service, calls } = buildService({
      id: 'admin-2',
      role: Role.ADMIN,
    });

    await expect(
      service.updateUser('admin-2', { role: Role.USER as any }, 'admin-1'),
    ).rejects.toThrow('Không thể cập nhật tài khoản quản trị viên khác');
    expect(calls).toHaveLength(0);
  });

  it('chặn admin vô hiệu hóa một quản trị viên khác', async () => {
    const { service, calls } = buildService({
      id: 'admin-2',
      role: Role.ADMIN,
    });

    await expect(
      service.updateUser('admin-2', { isActive: false }, 'admin-1'),
    ).rejects.toThrow('Không thể cập nhật tài khoản quản trị viên khác');
    expect(calls).toHaveLength(0);
  });

  it('chặn nâng một tài khoản thường lên quản trị viên', async () => {
    const { service, calls } = buildService();

    await expect(
      service.updateUser('u-1', { role: Role.ADMIN as any }, 'admin-1'),
    ).rejects.toThrow('Không thể gán vai trò quản trị viên cho tài khoản khác');
    expect(calls).toHaveLength(0);
  });

  it('vẫn cho admin tự sửa thông tin cá nhân của chính mình', async () => {
    const { service, calls } = buildService({
      id: 'admin-1',
      role: Role.ADMIN,
      branchId: null,
    });

    await service.updateUser('admin-1', { firstName: 'Khanh' }, 'admin-1');

    expect(calls).toHaveLength(1);
    expect(calls[0].data.firstName).toEqual('Khanh');
  });

  it('chặn admin tự vô hiệu hóa tài khoản của chính mình', async () => {
    const { service, calls } = buildService({
      id: 'admin-1',
      role: Role.ADMIN,
    });

    await expect(
      service.updateUser('admin-1', { isActive: false }, 'admin-1'),
    ).rejects.toThrow('Không thể vô hiệu hóa tài khoản của chính bạn');
    expect(calls).toHaveLength(0);
  });

  it('chặn admin tự thay đổi vai trò của chính mình', async () => {
    const { service, calls } = buildService({
      id: 'admin-1',
      role: Role.ADMIN,
    });

    await expect(
      service.updateUser('admin-1', { role: Role.USER as any }, 'admin-1'),
    ).rejects.toThrow('Không thể thay đổi vai trò của chính bạn');
    expect(calls).toHaveLength(0);
  });
});

describe('AdminService.assignBranch (bảo vệ tài khoản quản trị viên)', () => {
  it('chặn gán chi nhánh cho tài khoản quản trị viên khác', async () => {
    const { service, calls } = buildService({
      id: 'admin-2',
      role: Role.ADMIN,
      branchId: null,
    });

    await expect(
      service.assignBranch('admin-2', { branchId: 'b-1' }, 'admin-1'),
    ).rejects.toThrow(
      'Không thể chỉ định chi nhánh cho tài khoản quản trị viên',
    );
    expect(calls).toHaveLength(0);
  });
});

describe('AdminService.createUser (bảo vệ tài khoản quản trị viên)', () => {
  it('chặn tạo tài khoản mới với vai trò quản trị viên', async () => {
    const { service } = buildService();

    await expect(
      service.createUser({
        email: 'new-admin@cinema.local',
        password: 'password123',
        firstName: 'Minh',
        lastName: 'Nguyen',
        role: Role.ADMIN as any,
      }),
    ).rejects.toThrow('Không thể tạo tài khoản với vai trò quản trị viên');
  });
});

const buildFullService = () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  return {
    service: new AdminService(mockPrisma as unknown as PrismaService),
    mockPrisma,
  };
};

describe('AdminService (full coverage)', () => {
  const adminAuth: AuthUser = {
    sub: 'admin-1',
    email: 'admin@cinema.local',
    role: DomainRole.ADMIN,
    tokenVersion: 0,
  };

  describe('getDashboard', () => {
    it('throws ForbiddenException when admin does not exist, is inactive, or is not ADMIN', async () => {
      const { service, mockPrisma } = buildFullService();

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.getDashboard(adminAuth)).rejects.toThrow(
        ForbiddenException,
      );

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        isActive: false,
        role: Role.ADMIN,
      });
      await expect(service.getDashboard(adminAuth)).rejects.toThrow(
        ForbiddenException,
      );

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        isActive: true,
        role: Role.STAFF,
      });
      await expect(service.getDashboard(adminAuth)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns dashboard welcome message, admin info, and aggregated stats', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@cinema.local',
        firstName: 'An',
        lastName: 'Le',
        isActive: true,
        role: Role.ADMIN,
      });
      mockPrisma.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
      mockPrisma.user.groupBy.mockResolvedValue([
        { role: Role.ADMIN, _count: { id: 1 } },
        { role: Role.STAFF, _count: { id: 4 } },
        { role: Role.USER, _count: { id: 5 } },
      ]);

      const result = await service.getDashboard(adminAuth);

      expect(result.message).toBe('Welcome back, An Le');
      expect(result.admin).toEqual({
        userId: 'admin-1',
        email: 'admin@cinema.local',
        firstName: 'An',
        lastName: 'Le',
      });
      expect(result.stats).toMatchObject({
        totalUsers: 10,
        activeUsers: 8,
        inactiveUsers: 2,
        usersByRole: {
          [Role.ADMIN]: 1,
          [Role.MANAGER]: 0,
          [Role.STAFF]: 4,
          [Role.USER]: 5,
        },
      });
    });
  });

  describe('getUsers', () => {
    it('queries with empty filter when query params are omitted', async () => {
      const { service, mockPrisma } = buildFullService();
      const now = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'u-1',
          email: 'u1@cinema.local',
          firstName: 'Minh',
          lastName: 'Nguyen',
          role: Role.USER,
          isActive: true,
          branchId: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.getUsers({});

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.total).toBe(1);
      expect(result.users[0].userId).toBe('u-1');
    });

    it('applies search, role, and isActive filters when provided', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.getUsers({
        search: 'staff',
        role: DomainRole.STAFF,
        isActive: false,
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'staff', mode: 'insensitive' } },
              { firstName: { contains: 'staff', mode: 'insensitive' } },
              { lastName: { contains: 'staff', mode: 'insensitive' } },
            ],
            role: DomainRole.STAFF,
            isActive: false,
          },
        }),
      );
    });
  });

  describe('getUser', () => {
    it('returns user detail when found', async () => {
      const { service, mockPrisma } = buildFullService();
      const now = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'u1@cinema.local',
        firstName: 'Minh',
        lastName: 'Nguyen',
        role: Role.STAFF,
        isActive: true,
        branchId: 'b-1',
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.getUser('u-1');

      expect(result.user).toEqual({
        userId: 'u-1',
        email: 'u1@cinema.local',
        firstName: 'Minh',
        lastName: 'Nguyen',
        role: Role.STAFF,
        isActive: true,
        branchId: 'b-1',
        createdAt: now,
        updatedAt: now,
      });
    });

    it('throws NotFoundException when user is not found', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUser('missing')).rejects.toThrow(
        new NotFoundException('Không tìm thấy tài khoản'),
      );
    });
  });

  describe('getActiveBranches', () => {
    it('returns mapped list of active branches ordered by branchName asc', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.branch.findMany.mockResolvedValue([
        {
          id: 'b-1',
          branchName: 'Cinema Q1',
          address: '123 Le Loi',
          branchStatus: BranchStatus.ACTIVE,
        },
      ]);

      const result = await service.getActiveBranches();

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
        where: { branchStatus: BranchStatus.ACTIVE },
        select: {
          id: true,
          branchName: true,
          address: true,
          branchStatus: true,
        },
        orderBy: { branchName: 'asc' },
      });
      expect(result.branches).toEqual([
        {
          branchId: 'b-1',
          branchName: 'Cinema Q1',
          address: '123 Le Loi',
          branchStatus: BranchStatus.ACTIVE,
        },
      ]);
    });
  });

  describe('assignBranch', () => {
    it('throws ForbiddenException when admin tries to assign branch to self', async () => {
      const { service } = buildFullService();

      await expect(
        service.assignBranch('admin-1', { branchId: 'b-1' }, 'admin-1'),
      ).rejects.toThrow(
        new ForbiddenException(
          'Không thể chỉ định chi nhánh cho tài khoản của bạn',
        ),
      );
    });

    it('throws NotFoundException when target user does not exist', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignBranch('missing', { branchId: 'b-1' }, 'admin-1'),
      ).rejects.toThrow(new NotFoundException('Không tìm thấy tài khoản'));
    });

    it('throws BadRequestException when target user is inactive', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: Role.STAFF,
        isActive: false,
      });

      await expect(
        service.assignBranch('u-1', { branchId: 'b-1' }, 'admin-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Không thể chỉ định chi nhánh cho một tài khoản không hoạt động',
        ),
      );
    });

    it('throws BadRequestException when target user role is USER', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: Role.USER,
        isActive: true,
      });

      await expect(
        service.assignBranch('u-1', { branchId: 'b-1' }, 'admin-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Chỉ các tài khoản Branch Manager hoặc Staff mới có thể được chỉ định cho một chi nhánh',
        ),
      );
    });

    it('throws BadRequestException when target branch is missing or inactive', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: Role.STAFF,
        isActive: true,
      });
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.assignBranch('u-1', { branchId: 'b-inactive' }, 'admin-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Chi nhánh được chọn không hoạt động và không thể được chỉ định.',
        ),
      );
    });

    it('updates branchId and increments tokenVersion for active STAFF or MANAGER', async () => {
      const { service, mockPrisma } = buildFullService();
      const now = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        role: Role.MANAGER,
        isActive: true,
      });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u-1',
        email: 'mgr@cinema.local',
        firstName: 'An',
        lastName: 'Le',
        role: Role.MANAGER,
        isActive: true,
        branchId: 'b-1',
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.assignBranch(
        'u-1',
        { branchId: 'b-1' },
        'admin-1',
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: {
            branchId: 'b-1',
            tokenVersion: { increment: 1 },
          },
        }),
      );
      expect(result.message).toBe('Cập nhật tài khoản thành công.');
      expect(result.user.branchId).toBe('b-1');
    });
  });

  describe('createUser', () => {
    it('throws BadRequestException when branchId is given for inactive user or non-branch role', async () => {
      const { service } = buildFullService();

      await expect(
        service.createUser({
          email: 's@cinema.local',
          password: 'Password123!',
          firstName: 'A',
          lastName: 'B',
          role: DomainRole.STAFF,
          isActive: false,
          branchId: 'b-1',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createUser({
          email: 'u@cinema.local',
          password: 'Password123!',
          firstName: 'A',
          lastName: 'B',
          role: DomainRole.USER,
          branchId: 'b-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when branchId refers to inactive or missing branch', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.createUser({
          email: 's@cinema.local',
          password: 'Password123!',
          firstName: 'A',
          lastName: 'B',
          role: DomainRole.STAFF,
          branchId: 'b-missing',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates user with defaults and lowercased email when optional fields are omitted', async () => {
      const { service, mockPrisma } = buildFullService();
      const now = new Date('2026-01-01T00:00:00.000Z');
      type CreateUserData = {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: Role;
        isActive: boolean;
        branchId?: string;
      };
      mockPrisma.user.create.mockImplementation(
        ({ data }: { data: CreateUserData }) =>
          Promise.resolve({
            id: 'u-new',
            ...data,
            branchId: data.branchId ?? null,
            createdAt: now,
            updatedAt: now,
          }),
      );

      const result = await service.createUser({
        email: 'NewUser@Cinema.Local',
        password: 'Password123!',
        firstName: 'Minh',
        lastName: 'Nguyen',
      });

      const createCalls = mockPrisma.user.create.mock.calls as Array<
        [{ data: CreateUserData }]
      >;
      const createArg = createCalls[0][0].data;
      expect(createArg.email).toBe('newuser@cinema.local');
      expect(createArg.role).toBe(Role.USER);
      expect(createArg.isActive).toBe(true);
      expect(createArg.branchId).toBeUndefined();
      await expect(
        bcrypt.compare('Password123!', createArg.password),
      ).resolves.toBe(true);
      expect(result.message).toBe('Tạo tài khoản thành công');
      expect(result.user.userId).toBe('u-new');
    });

    it('creates active MANAGER user assigned to an active branch', async () => {
      const { service, mockPrisma } = buildFullService();
      const now = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-mgr',
        email: 'mgr@cinema.local',
        firstName: 'Minh',
        lastName: 'Nguyen',
        role: Role.MANAGER,
        isActive: true,
        branchId: 'b-1',
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.createUser({
        email: 'mgr@cinema.local',
        password: 'Password123!',
        firstName: 'Minh',
        lastName: 'Nguyen',
        role: DomainRole.BRANCHMANAGER,
        isActive: true,
        branchId: 'b-1',
      });

      expect(result.user.branchId).toBe('b-1');
    });

    it('throws ConflictException on Prisma P2002 error and rethrows other errors', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.create.mockRejectedValueOnce(
        Object.assign(new Error('dup'), { code: 'P2002' }),
      );

      await expect(
        service.createUser({
          email: 'dup@cinema.local',
          password: 'Password123!',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toThrow(
        new ConflictException(
          'Tên người dùng phải là duy nhất trong toàn hệ thống.',
        ),
      );

      mockPrisma.user.create.mockRejectedValueOnce(new Error('db offline'));
      await expect(
        service.createUser({
          email: 'err@cinema.local',
          password: 'Password123!',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toThrow('db offline');
    });
  });

  describe('updateUser (validation & Prisma errors)', () => {
    it('throws BadRequestException when update payload is empty', async () => {
      const { service } = buildFullService();

      await expect(service.updateUser('u-1', {}, 'admin-1')).rejects.toThrow(
        new BadRequestException(
          'Ít nhất một trường phải được cung cấp để cập nhật',
        ),
      );
    });

    it('throws specific NotFoundException messages when target user does not exist', async () => {
      const { service, mockPrisma } = buildFullService();
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser('admin-1', { firstName: 'A' }, 'admin-1'),
      ).rejects.toThrow(
        new NotFoundException('Không tìm thấy tài khoản của bạn'),
      );

      await expect(
        service.updateUser('u-missing', { firstName: 'A' }, 'admin-1'),
      ).rejects.toThrow(
        new NotFoundException('Không tìm thấy tài khoản để cập nhật'),
      );
    });

    it('lowercases email and maps Prisma P2002, P2025, and generic errors', async () => {
      const { service, mockPrisma } = buildFullService();
      const now = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.USER });
      mockPrisma.user.update
        .mockResolvedValueOnce({
          id: 'u-1',
          email: 'updated@cinema.local',
          firstName: 'A',
          lastName: 'B',
          role: Role.USER,
          isActive: true,
          branchId: null,
          createdAt: now,
          updatedAt: now,
        })
        .mockRejectedValueOnce(
          Object.assign(new Error('dup'), { code: 'P2002' }),
        )
        .mockRejectedValueOnce(
          Object.assign(new Error('missing'), { code: 'P2025' }),
        )
        .mockRejectedValueOnce(new Error('db write failed'));

      const ok = await service.updateUser(
        'u-1',
        { email: 'UPDATED@CINEMA.LOCAL' },
        'admin-1',
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { email: 'updated@cinema.local' },
        }),
      );
      expect(ok.user.email).toBe('updated@cinema.local');

      await expect(
        service.updateUser('u-1', { email: 'dup@cinema.local' }, 'admin-1'),
      ).rejects.toThrow(
        new ConflictException(REGISTRATION_MESSAGES.EMAIL_ALREADY_REGISTERED),
      );

      await expect(
        service.updateUser('u-1', { firstName: 'X' }, 'admin-1'),
      ).rejects.toThrow(
        new NotFoundException('Không tìm thấy tài khoản để cập nhật'),
      );

      await expect(
        service.updateUser('u-1', { firstName: 'Y' }, 'admin-1'),
      ).rejects.toThrow('db write failed');
    });
  });
});
