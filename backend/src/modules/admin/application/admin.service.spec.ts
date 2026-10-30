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
