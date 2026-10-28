import { Model } from 'mongoose';
import { AdminService } from './admin.service';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { BranchDocument } from '../../branch/domain/schemas/branch.schema';
import { Role } from '../../user/domain/enums/role.enum';

type UpdateCall = {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
};

/**
 * Capture the raw update document handed to Mongoose so the test can assert
 * on `$unset` directly instead of guessing from a stubbed return value.
 */
const buildService = (stored: Partial<User> = {}) => {
  const calls: UpdateCall[] = [];
  const updated = {
    userId: 'u-1',
    email: 'staff@cinema.local',
    firstName: 'Minh',
    lastName: 'Nguyen',
    role: Role.USER,
    isActive: true,
  };

  const userModel = {
    findOne: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            userId: 'u-1',
            role: Role.STAFF,
            branchId: 'b-1',
            ...stored,
          }),
        }),
      }),
    }),
    findOneAndUpdate: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        calls.push({ filter, update });
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(updated),
            }),
          }),
        };
      },
    ),
  } as unknown as Model<UserDocument>;

  const branchModel = {} as unknown as Model<BranchDocument>;

  return {
    service: new AdminService(userModel, branchModel),
    calls,
  };
};

describe('AdminService.updateUser (branch cleanup on role change)', () => {
  it('unsets branchId when a staff account becomes a customer', async () => {
    const { service, calls } = buildService();

    await service.updateUser('u-1', { role: Role.USER }, 'admin-1');

    expect(calls).toHaveLength(1);
    expect(calls[0].update.$unset).toEqual({ branchId: '' });
  });

  it('unsets branchId when a branch manager becomes a customer', async () => {
    const { service, calls } = buildService({ role: Role.BRANCHMANAGER });

    await service.updateUser('u-1', { role: Role.USER }, 'admin-1');

    expect(calls[0].update.$unset).toEqual({ branchId: '' });
  });

  it('keeps branchId when the new role still works at a branch', async () => {
    const { service, calls } = buildService();

    await service.updateUser('u-1', { role: Role.BRANCHMANAGER }, 'admin-1');

    expect(calls[0].update.$unset).toBeUndefined();
    expect(calls[0].update.$set).toEqual({ role: Role.BRANCHMANAGER });
  });

  it('keeps branchId when the update does not touch the role', async () => {
    const { service, calls } = buildService();

    await service.updateUser('u-1', { firstName: 'Khanh' }, 'admin-1');

    // A rename must not strip the branch the account still works at.
    expect(calls[0].update.$unset).toBeUndefined();
  });

  it('still bumps tokenVersion when deactivating alongside a demotion', async () => {
    const { service, calls } = buildService();

    await service.updateUser(
      'u-1',
      { role: Role.USER, isActive: false },
      'admin-1',
    );

    expect(calls[0].update.$unset).toEqual({ branchId: '' });
    expect(calls[0].update.$inc).toEqual({ tokenVersion: 1 });
  });
});
