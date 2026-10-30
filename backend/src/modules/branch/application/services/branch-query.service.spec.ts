import { BranchStatus } from '@prisma/client';
import { BranchQueryService } from './branch-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const BRANCH_A = 'branch-a';

describe('BranchQueryService', () => {
  let service: BranchQueryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      branch: {
        findUnique: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(
            args.where.id === BRANCH_A
              ? {
                  id: BRANCH_A,
                  branchName: 'CGV Quận 1',
                  address: 'addr',
                  branchStatus: BranchStatus.ACTIVE,
                }
              : null,
          ),
        ),
        findMany: jest.fn(),
      },
    };

    service = new BranchQueryService(mockPrisma as unknown as PrismaService);
  });

  describe('getBranchSummary', () => {
    it('returns only branchId and branchName for an existing branch', async () => {
      const result = await service.getBranchSummary(BRANCH_A);

      expect(mockPrisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: BRANCH_A },
        select: { id: true, branchName: true },
      });
      expect(result).toEqual({ branchId: BRANCH_A, branchName: 'CGV Quận 1' });
    });

    it('returns null when branch does not exist', async () => {
      await expect(service.getBranchSummary('zzz')).resolves.toBeNull();
    });

    it('propagates database errors', async () => {
      mockPrisma.branch.findUnique.mockRejectedValue(new Error('db down'));

      await expect(service.getBranchSummary(BRANCH_A)).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('getPublicBranches', () => {
    it('returns only ACTIVE branches sorted by branchName ASC with fallback hotline', async () => {
      const mockDocs = [
        {
          id: 'branch-cantavil',
          branchName: 'Lotte Cinema Cantavil',
          address: 'Tầng 7, Cantavil Premier',
          hotline: '028 3740 6180',
          branchStatus: BranchStatus.ACTIVE,
        },
        {
          id: 'branch-govap',
          branchName: 'Lotte Cinema Gò Vấp',
          address: '242 Nguyễn Văn Lượng',
          hotline: '',
          branchStatus: BranchStatus.ACTIVE,
        },
      ];

      mockPrisma.branch.findMany.mockResolvedValue(mockDocs);

      const result = await service.getPublicBranches();

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
        where: { branchStatus: BranchStatus.ACTIVE },
        select: {
          id: true,
          branchName: true,
          address: true,
          hotline: true,
          branchStatus: true,
        },
        orderBy: { branchName: 'asc' },
      });
      expect(result).toEqual([
        {
          branchId: 'branch-cantavil',
          branchName: 'Lotte Cinema Cantavil',
          address: 'Tầng 7, Cantavil Premier',
          hotline: '028 3740 6180',
          branchStatus: BranchStatus.ACTIVE,
        },
        {
          branchId: 'branch-govap',
          branchName: 'Lotte Cinema Gò Vấp',
          address: '242 Nguyễn Văn Lượng',
          hotline: '1900 2224',
          branchStatus: BranchStatus.ACTIVE,
        },
      ]);
    });

    it('filters branches by search query case-insensitively on branchName or address', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);

      await service.getPublicBranches({ search: '  cantavil  ' });

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
        where: {
          branchStatus: BranchStatus.ACTIVE,
          OR: [
            { branchName: { contains: 'cantavil', mode: 'insensitive' } },
            { address: { contains: 'cantavil', mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          branchName: true,
          address: true,
          hotline: true,
          branchStatus: true,
        },
        orderBy: { branchName: 'asc' },
      });
    });
  });
});
