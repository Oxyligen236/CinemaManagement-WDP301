import { ForbiddenException } from '@nestjs/common';
import { Model } from 'mongoose';
import { BranchStaffService } from './branch-staff.service';
import { UserDocument } from '../../user/domain/schemas/user.schema';
import { BranchDocument } from '../../branch/domain/schemas/branch.schema';
import { BranchStatus } from '../../branch/domain/enums/branch-status.enum';
import { Role } from '../../user/domain/enums/role.enum';
import { JobPosition } from '../../user/domain/enums/job-position.enum';
import { STAFF_MESSAGES } from '../domain/staff.rules';

type ManagerRow = {
  role: string;
  isActive: boolean;
  branchId?: string;
};

const BRANCH = {
  branchId: 'branch-a',
  branchName: 'Chi nhánh A',
  address: '1 Lê Lợi',
  branchStatus: BranchStatus.ACTIVE,
};

/**
 * `getManagerBranch` chạy 2 query: user trước, branch sau. Chỉ cần dựng
 * `findOne().select().lean().exec()` cho từng model.
 */
const buildService = (manager: ManagerRow | null, branch: unknown = BRANCH) => {
  const chain = (value: unknown) => ({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(value),
      }),
    }),
  });

  const userModel = {
    findOne: jest.fn().mockReturnValue(chain(manager)),
  } as unknown as Model<UserDocument>;

  const branchModel = {
    findOne: jest.fn().mockReturnValue(chain(branch)),
  } as unknown as Model<BranchDocument>;

  return new BranchStaffService(userModel, branchModel);
};

describe('BranchStaffService.getOptions - quyền truy cập', () => {
  it('cho phép Branch Manager đã được phân công chi nhánh', async () => {
    const service = buildService({
      role: Role.BRANCHMANAGER,
      isActive: true,
      branchId: BRANCH.branchId,
    });

    await expect(service.getOptions('mgr-1')).resolves.toMatchObject({
      branch: { branchId: BRANCH.branchId },
      jobPositions: [JobPosition.TICKET_SELLER],
    });
  });

  // Đây là nguyên nhân thật của 403 trên dữ liệu hiện tại: role đã đúng,
  // nhưng tài khoản chưa được Admin phân công chi nhánh.
  it('báo lỗi chưa được phân công chi nhánh khi manager không có branchId', async () => {
    const service = buildService({ role: Role.BRANCHMANAGER, isActive: true });

    await expect(service.getOptions('mgr-nobranch')).rejects.toThrow(
      new ForbiddenException(STAFF_MESSAGES.NO_BRANCH),
    );
  });

  it('báo lỗi chưa được phân công chi nhánh khi branchId trỏ tới chi nhánh không tồn tại', async () => {
    const service = buildService(
      { role: Role.BRANCHMANAGER, isActive: true, branchId: 'branch-missing' },
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
        branchId: BRANCH.branchId,
      });

      await expect(service.getOptions('other-role')).rejects.toThrow(
        new ForbiddenException(STAFF_MESSAGES.FORBIDDEN),
      );
    },
  );

  it('chặn tài khoản Branch Manager đã bị vô hiệu hóa', async () => {
    const service = buildService({
      role: Role.BRANCHMANAGER,
      isActive: false,
      branchId: BRANCH.branchId,
    });

    await expect(service.getOptions('mgr-off')).rejects.toThrow(
      new ForbiddenException(STAFF_MESSAGES.FORBIDDEN),
    );
  });
});
