import { AdminService } from './admin.service';
import { Role } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

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
