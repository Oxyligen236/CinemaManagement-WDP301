import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../../domain/schemas/user.schema';
import { UserBranchQueryService } from './user-branch-query.service';

const chain = (result: unknown) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const BRANCH_A = 'branch-a';
const USERS: Record<string, Record<string, unknown>> = {
  'mgr-a': { userId: 'mgr-a', branchId: BRANCH_A, isActive: true },
  'mgr-none': { userId: 'mgr-none', isActive: true },
  'mgr-off': { userId: 'mgr-off', branchId: BRANCH_A, isActive: false },
};

describe('UserBranchQueryService', () => {
  let service: UserBranchQueryService;
  const userModel = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    userModel.findOne.mockImplementation((f: { userId: string }) =>
      chain(USERS[f.userId] ?? null),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserBranchQueryService,
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();
    service = moduleRef.get(UserBranchQueryService);
  });

  it('returns branchId of an active user with a branch', async () => {
    await expect(service.getBranchIdOfUser('mgr-a')).resolves.toBe(BRANCH_A);
    expect(userModel.findOne).toHaveBeenCalledWith({ userId: 'mgr-a' });
  });

  it('selects only branchId and isActive', async () => {
    const query = chain(USERS['mgr-a']);
    userModel.findOne.mockReturnValue(query);

    await service.getBranchIdOfUser('mgr-a');

    expect(query.select).toHaveBeenCalledWith('branchId isActive');
  });

  it('returns null when user has no branch', async () => {
    await expect(service.getBranchIdOfUser('mgr-none')).resolves.toBeNull();
  });

  it('returns null when user is deactivated', async () => {
    await expect(service.getBranchIdOfUser('mgr-off')).resolves.toBeNull();
  });

  it('returns null when user does not exist', async () => {
    await expect(service.getBranchIdOfUser('ghost')).resolves.toBeNull();
  });

  it('propagates database errors', async () => {
    userModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('mongo down')),
    });

    await expect(service.getBranchIdOfUser('mgr-a')).rejects.toThrow(
      'mongo down',
    );
  });
});
