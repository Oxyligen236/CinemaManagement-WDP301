import { UserBranchQueryService } from './user-branch-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const BRANCH_A = 'branch-a';
const USERS: Record<string, Record<string, unknown>> = {
  'mgr-a': { id: 'mgr-a', branchId: BRANCH_A, isActive: true },
  'mgr-none': { id: 'mgr-none', isActive: true },
  'mgr-off': { id: 'mgr-off', branchId: BRANCH_A, isActive: false },
};

describe('UserBranchQueryService', () => {
  let service: UserBranchQueryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(USERS[args.where.id] ?? null),
        ),
      },
    };
    service = new UserBranchQueryService(mockPrisma as unknown as PrismaService);
  });

  it('returns branchId of an active user with a branch', async () => {
    await expect(service.getBranchIdOfUser('mgr-a')).resolves.toBe(BRANCH_A);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'mgr-a' },
      select: { branchId: true, isActive: true },
    });
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
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));

    await expect(service.getBranchIdOfUser('mgr-a')).rejects.toThrow('db down');
  });
});
