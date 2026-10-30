import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BranchStatus } from '../../domain/enums/branch-status.enum';
import { Branch } from '../../domain/schemas/branch.schema';
import { BranchQueryService } from './branch-query.service';

const chain = (result: unknown) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const BRANCH_A = '507f1f77bcf86cd799439011';

describe('BranchQueryService', () => {
  let service: BranchQueryService;
  const branchModel = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    branchModel.findById.mockImplementation((id: string) =>
      chain(
        id === BRANCH_A
          ? {
              _id: BRANCH_A,
              branchName: 'CGV Quận 1',
              address: 'addr',
              branchStatus: BranchStatus.ACTIVE,
            }
          : null,
      ),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchQueryService,
        { provide: getModelToken(Branch.name), useValue: branchModel },
      ],
    }).compile();
    service = moduleRef.get(BranchQueryService);
  });

  describe('getBranchSummary', () => {
    it('returns only branchId and branchName for an existing branch', async () => {
      const result = await service.getBranchSummary(BRANCH_A);

      expect(branchModel.findById).toHaveBeenCalledWith(BRANCH_A);
      expect(result).toEqual({ branchId: BRANCH_A, branchName: 'CGV Quận 1' });
    });

    it('returns null when branch does not exist', async () => {
      await expect(
        service.getBranchSummary('507f1f77bcf86cd799439099'),
      ).resolves.toBeNull();
    });

    it('returns null when branchId is not valid object id', async () => {
      await expect(service.getBranchSummary('invalid-id')).resolves.toBeNull();
      expect(branchModel.findById).not.toHaveBeenCalled();
    });

    it('propagates database errors', async () => {
      branchModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('mongo down')),
      });

      await expect(service.getBranchSummary(BRANCH_A)).rejects.toThrow(
        'mongo down',
      );
    });
  });

  describe('getPublicBranches', () => {
    it('returns only ACTIVE branches sorted by branchName ASC with fallback hotline', async () => {
      const mockDocs = [
        {
          _id: '507f1f77bcf86cd799439012',
          branchName: 'Lotte Cinema Cantavil',
          address: 'Tầng 7, Cantavil Premier',
          hotline: '028 3740 6180',
          branchStatus: BranchStatus.ACTIVE,
        },
        {
          _id: '507f1f77bcf86cd799439013',
          branchName: 'Lotte Cinema Gò Vấp',
          address: '242 Nguyễn Văn Lượng',
          hotline: '',
          branchStatus: BranchStatus.ACTIVE,
        },
      ];

      const queryChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDocs),
      };
      branchModel.find.mockReturnValue(queryChain);

      const result = await service.getPublicBranches();

      expect(branchModel.find).toHaveBeenCalledWith({
        branchStatus: BranchStatus.ACTIVE,
      });
      expect(queryChain.select).toHaveBeenCalledWith(
        'branchName address hotline branchStatus',
      );
      expect(queryChain.sort).toHaveBeenCalledWith({ branchName: 1 });
      expect(result).toEqual([
        {
          branchId: '507f1f77bcf86cd799439012',
          branchName: 'Lotte Cinema Cantavil',
          address: 'Tầng 7, Cantavil Premier',
          hotline: '028 3740 6180',
          branchStatus: BranchStatus.ACTIVE,
        },
        {
          branchId: '507f1f77bcf86cd799439013',
          branchName: 'Lotte Cinema Gò Vấp',
          address: '242 Nguyễn Văn Lượng',
          hotline: '1900 2224',
          branchStatus: BranchStatus.ACTIVE,
        },
      ]);
    });

    it('filters branches by search query case-insensitively on branchName or address', async () => {
      const queryChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      branchModel.find.mockReturnValue(queryChain);

      await service.getPublicBranches({ search: '  cantavil  ' });

      expect(branchModel.find).toHaveBeenCalledWith({
        branchStatus: BranchStatus.ACTIVE,
        $or: [{ branchName: /cantavil/i }, { address: /cantavil/i }],
      });
    });

    it('escapes special regex characters in search query', async () => {
      const queryChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      branchModel.find.mockReturnValue(queryChain);

      await service.getPublicBranches({ search: 'cinema (q1) [vip]' });

      expect(branchModel.find).toHaveBeenCalledWith({
        branchStatus: BranchStatus.ACTIVE,
        $or: [
          { branchName: /cinema \(q1\) \[vip\]/i },
          { address: /cinema \(q1\) \[vip\]/i },
        ],
      });
    });

    it('propagates database error when query fails', async () => {
      const queryChain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('db connection lost')),
      };
      branchModel.find.mockReturnValue(queryChain);

      await expect(service.getPublicBranches()).rejects.toThrow(
        'db connection lost',
      );
    });
  });
});
