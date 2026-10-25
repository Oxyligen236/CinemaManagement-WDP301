import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Branch } from '../../domain/schemas/branch.schema';
import { BranchQueryService } from './branch-query.service';

const chain = (result: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const BRANCH_A = 'branch-a';

describe('BranchQueryService', () => {
  let service: BranchQueryService;
  const branchModel = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    branchModel.findOne.mockImplementation((f: { branchId: string }) =>
      chain(
        f.branchId === BRANCH_A
          ? {
              branchId: BRANCH_A,
              branchName: 'CGV Quận 1',
              address: 'addr',
              branchStatus: 'ACTIVE',
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

  it('returns only branchId and branchName for an existing branch', async () => {
    const result = await service.getBranchSummary(BRANCH_A);

    expect(branchModel.findOne).toHaveBeenCalledWith({ branchId: BRANCH_A });
    expect(result).toEqual({ branchId: BRANCH_A, branchName: 'CGV Quận 1' });
  });

  it('returns null when branch does not exist', async () => {
    await expect(service.getBranchSummary('zzz')).resolves.toBeNull();
  });

  it('propagates database errors', async () => {
    branchModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('mongo down')),
    });

    await expect(service.getBranchSummary(BRANCH_A)).rejects.toThrow(
      'mongo down',
    );
  });
});
