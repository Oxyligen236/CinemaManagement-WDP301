import { Model, Types } from 'mongoose';
import { AdminService } from './admin.service';
import { User, UserDocument } from '../../user/domain/schemas/user.schema';
import { BranchDocument } from '../../branch/domain/schemas/branch.schema';
import { Role } from '../../user/domain/enums/role.enum';

type UpdateCall = {
  id: unknown;
  update: Record<string, unknown>;
};

/**
 * Capture the raw update document handed to Mongoose so the test can assert
 * on `$unset` directly instead of guessing from a stubbed return value.
 */
const buildService = (stored: Partial<User> = {}) => {
  const calls: UpdateCall[] = [];
  const fakeId = new Types.ObjectId('64b8f0f1a1a1a1a1a1a1a1a1');
  const updated = {
    _id: fakeId,
    email: 'staff@cinema.local',
    firstName: 'Minh',
    lastName: 'Nguyen',
    role: Role.USER,
    isActive: true,
  };

  const userModel = {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: fakeId,
            role: Role.STAFF,
            branchId: 'b-1',
            ...stored,
          }),
        }),
      }),
    }),
    findByIdAndUpdate: jest.fn(
      (id: unknown, update: Record<string, unknown>) => {
        calls.push({ id, update });
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
  const targetId = '64b8f0f1a1a1a1a1a1a1a1a1';
  const adminId = '64b8f0f1a1a1a1a1a1a1a1a2';

  it('unsets branchId when a staff account becomes a customer', async () => {
    const { service, calls } = buildService();

    await service.updateUser(targetId, { role: Role.USER }, adminId);

    expect(calls).toHaveLength(1);
    expect(calls[0].update.$unset).toEqual({ branchId: '' });
  });

  it('unsets branchId when a branch manager becomes a customer', async () => {
    const { service, calls } = buildService({ role: Role.BRANCHMANAGER });

    await service.updateUser(targetId, { role: Role.USER }, adminId);

    expect(calls[0].update.$unset).toEqual({ branchId: '' });
  });

  it('keeps branchId when the new role still works at a branch', async () => {
    const { service, calls } = buildService();

    await service.updateUser(targetId, { role: Role.BRANCHMANAGER }, adminId);

    expect(calls[0].update.$unset).toBeUndefined();
    expect(calls[0].update.$set).toEqual({ role: Role.BRANCHMANAGER });
  });

  it('keeps branchId when the update does not touch the role', async () => {
    const { service, calls } = buildService();

    await service.updateUser(targetId, { firstName: 'Khanh' }, adminId);

    // A rename must not strip the branch the account still works at.
    expect(calls[0].update.$unset).toBeUndefined();
  });

  it('still bumps tokenVersion when deactivating alongside a demotion', async () => {
    const { service, calls } = buildService();

    await service.updateUser(
      targetId,
      { role: Role.USER, isActive: false },
      adminId,
    );

    expect(calls[0].update.$unset).toEqual({ branchId: '' });
    expect(calls[0].update.$inc).toEqual({ tokenVersion: 1 });
  });
});
