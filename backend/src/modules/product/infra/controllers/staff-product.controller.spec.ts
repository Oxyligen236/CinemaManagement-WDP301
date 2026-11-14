import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedRequest } from '../../../auth/domain/auth-user';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { Role } from '../../../user/domain/enums/role.enum';
import { ProductService } from '../../application/services/product.service';
import { StaffProductController } from './staff-product.controller';

describe('StaffProductController', () => {
  let controller: StaffProductController;
  let productService: { getBranchConcessions: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };

  const mockReq = {
    user: {
      sub: 'staff-1',
      email: 'staff@example.com',
      role: Role.STAFF,
      tokenVersion: 0,
    },
  } as AuthenticatedRequest;

  beforeEach(async () => {
    productService = { getBranchConcessions: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffProductController],
      providers: [
        { provide: ProductService, useValue: productService },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StaffProductController>(StaffProductController);
  });

  it('throws ForbiddenException when staff user is missing, inactive, or unassigned to branch', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(controller.getStaffConcessions(mockReq)).rejects.toThrow(
      ForbiddenException,
    );

    prisma.user.findUnique.mockResolvedValueOnce({
      branchId: null,
      isActive: true,
    });
    await expect(controller.getStaffConcessions(mockReq)).rejects.toThrow(
      ForbiddenException,
    );

    prisma.user.findUnique.mockResolvedValueOnce({
      branchId: 'branch-1',
      isActive: false,
    });
    await expect(controller.getStaffConcessions(mockReq)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns branch concessions catalog for active staff with branchId', async () => {
    prisma.user.findUnique.mockResolvedValue({
      branchId: 'branch-1',
      isActive: true,
    });
    const catalog = { branchId: 'branch-1', items: [], combos: [] };
    productService.getBranchConcessions.mockResolvedValue(catalog);

    const res = await controller.getStaffConcessions(mockReq);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      select: { branchId: true, isActive: true },
    });
    expect(productService.getBranchConcessions).toHaveBeenCalledWith(
      'branch-1',
    );
    expect(res).toBe(catalog);
  });
});
