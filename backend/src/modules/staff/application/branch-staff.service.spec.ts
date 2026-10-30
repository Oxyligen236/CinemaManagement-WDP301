import { ForbiddenException } from '@nestjs/common';
import { BranchStaffService } from './branch-staff.service';
import { BranchStatus, Role, JobPosition } from '@prisma/client';
import { STAFF_MESSAGES } from '../domain/staff.rules';
import { PrismaService } from '../../infra/prisma/prisma.service';

type ManagerRow = {
  role: Role | string;
  isActive: boolean;
  branchId?: string | null;
};

const BRANCH = {
  id: 'branch-a',
  branchName: 'Chi nhánh A',
  address: '1 Lê Lợi',
  branchStatus: BranchStatus.ACTIVE,
};

const buildService = (manager: ManagerRow | null, branch: any = BRANCH) => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(manager),
    },
    branch: {
      findUnique: jest.fn().mockResolvedValue(branch),
    },
  };

  return new BranchStaffService(mockPrisma as unknown as PrismaService);
};

describe('BranchStaffService.getOptions - quyền truy cập', () => {
  it('cho phép Branch Manager đã được phân công chi nhánh', async () => {
    const service = buildService({
      role: Role.MANAGER,
      isActive: true,
      branchId: BRANCH.id,
    });

    await expect(service.getOptions('mgr-1')).resolves.toMatchObject({
      branch: { branchId: BRANCH.id },
      jobPositions: [JobPosition.TICKET_SELLER],
    });
  });

  it('báo lỗi chưa được phân công chi nhánh khi manager không có branchId', async () => {
    const service = buildService({
      role: Role.MANAGER,
      isActive: true,
      branchId: undefined,
    });

    await expect(service.getOptions('mgr-unassigned')).rejects.toThrow(
      new ForbiddenException(STAFF_MESSAGES.NO_BRANCH),
    );
  });

  it('báo lỗi chưa được phân công chi nhánh khi branchId trỏ tới chi nhánh không tồn tại', async () => {
    const service = buildService(
      { role: Role.MANAGER, isActive: true, branchId: 'branch-missing' },
      null,
    );

    await expect(service.getOptions('mgr-dangling')).rejects.toThrow(
      new ForbiddenException(STAFF_MESSAGES.NO_BRANCH),
    );
  });

  it.each([Role.ADMIN, Role.STAFF, Role.USER])(
    'chặn %s bằng thông báo sai quyền, không phải thông báo thiếu chi nhánh',
    async (role) => {
      const service = buildService({
        role,
        isActive: true,
        branchId: BRANCH.id,
      });

      await expect(service.getOptions('other-role')).rejects.toThrow(
        new ForbiddenException(STAFF_MESSAGES.FORBIDDEN),
      );
    },
  );

  it('chặn tài khoản Branch Manager đã bị vô hiệu hóa', async () => {
    const service = buildService({
      role: Role.MANAGER,
      isActive: false,
      branchId: BRANCH.id,
    });

    await expect(service.getOptions('mgr-off')).rejects.toThrow(
      new ForbiddenException(STAFF_MESSAGES.FORBIDDEN),
    );
  });
});
