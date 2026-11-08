import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { BranchStaffService } from './branch-staff.service';
import { BranchStatus, Role } from '@prisma/client';
// DTO khai báo theo enum của domain (không phải enum sinh bởi Prisma), nên
// test phải dùng đúng enum đó để kiểu của tham số khớp với service.
import { JobPosition } from '../../user/domain/enums/job-position.enum';
import { EmploymentStatus } from '../../user/domain/enums/employment-status.enum';
import {
  STAFF_MESSAGES,
  STAFF_VALIDATION_MESSAGES,
} from '../domain/staff.rules';
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

const MANAGER: ManagerRow = {
  role: Role.MANAGER,
  isActive: true,
  branchId: BRANCH.id,
};

const VALID_INPUT = {
  email: 'nhanvien@latte.vn',
  password: 'matkhau123',
  firstName: 'An',
  lastName: 'Nguyễn',
  jobPosition: JobPosition.TICKET_SELLER,
};

/**
 * Service dùng được cho create/update: `user.findUnique` phải trả hồ sơ quản
 * lý ở lần gọi đầu (xác thực quyền) và hàng email trùng / nhân viên ở các lần
 * sau, nên không thể dùng chung `buildService` một giá trị cố định.
 */
const buildCrudService = (overrides: {
  existingEmailOwner?: unknown;
  staffRow?: unknown;
  branch?: any;
  onCreate?: jest.Mock;
  onUpdate?: jest.Mock;
}) => {
  const findUnique = jest
    .fn()
    .mockResolvedValueOnce(MANAGER)
    .mockResolvedValue(overrides.existingEmailOwner ?? null);

  const mockPrisma = {
    user: {
      findUnique,
      findFirst: jest.fn().mockResolvedValue(overrides.staffRow ?? null),
      create: overrides.onCreate ?? jest.fn(),
      update: overrides.onUpdate ?? jest.fn(),
    },
    branch: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.branch === undefined ? BRANCH : overrides.branch,
        ),
    },
  };

  return new BranchStaffService(mockPrisma as unknown as PrismaService);
};

/** Thân response của lỗi, nơi chứa `fieldErrors` mà giao diện dùng. */
const errorBody = (error: unknown) =>
  (error as HttpException).getResponse() as Record<string, unknown>;

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

describe('BranchStaffService.createStaff - lỗi gắn với đúng trường', () => {
  it('trả lỗi email trùng kèm fieldErrors.email để giao diện hiện dưới ô email', async () => {
    const service = buildCrudService({
      existingEmailOwner: { id: 'other-user' },
    });

    const error = await service
      .createStaff('mgr-1', VALID_INPUT)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(errorBody(error)).toMatchObject({
      statusCode: 409,
      message: STAFF_MESSAGES.ACCOUNT_EXISTS,
      fields: ['email'],
      fieldErrors: { email: STAFF_MESSAGES.ACCOUNT_EXISTS },
    });
  });

  it('coi vi phạm unique của Prisma (P2002) là email trùng, không phải lỗi hệ thống', async () => {
    const service = buildCrudService({
      onCreate: jest.fn().mockRejectedValue({ code: 'P2002' }),
    });

    const error = await service
      .createStaff('mgr-1', VALID_INPUT)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(errorBody(error)).toMatchObject({
      fieldErrors: { email: STAFF_MESSAGES.ACCOUNT_EXISTS },
    });
  });

  it('gắn lỗi vị trí công việc ngoài danh mục vào trường jobPosition', async () => {
    const service = buildCrudService({});

    const error = await service
      .createStaff('mgr-1', {
        ...VALID_INPUT,
        jobPosition: 'MANAGER' as JobPosition,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(errorBody(error)).toMatchObject({
      fields: ['jobPosition'],
      fieldErrors: {
        jobPosition: STAFF_VALIDATION_MESSAGES.JOB_POSITION_INVALID,
      },
    });
  });

  it('gắn lỗi trạng thái không được phép khi tạo vào trường employmentStatus', async () => {
    const service = buildCrudService({});

    const error = await service
      .createStaff('mgr-1', {
        ...VALID_INPUT,
        employmentStatus: EmploymentStatus.RESIGNED,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(errorBody(error)).toMatchObject({
      fields: ['employmentStatus'],
      fieldErrors: {
        employmentStatus:
          STAFF_VALIDATION_MESSAGES.EMPLOYMENT_STATUS_NOT_CREATABLE,
      },
    });
  });

  it('chi nhánh ngừng hoạt động là lỗi chung, không gắn vào trường nào của form', async () => {
    const service = buildCrudService({
      branch: { ...BRANCH, branchStatus: BranchStatus.INACTIVE },
    });

    const error = await service
      .createStaff('mgr-1', VALID_INPUT)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      STAFF_MESSAGES.BRANCH_NOT_ACTIVE,
    );
    expect(errorBody(error)).not.toHaveProperty('fieldErrors');
  });
});

describe('BranchStaffService.updateStaff - lỗi gắn với đúng trường', () => {
  const STAFF_ROW = {
    id: 'staff-1',
    email: 'nhanvien@latte.vn',
    firstName: 'An',
    lastName: 'Nguyễn',
    branchId: BRANCH.id,
    jobPosition: JobPosition.TICKET_SELLER,
    employmentStatus: EmploymentStatus.ACTIVE,
    isActive: true,
  };

  it('gắn lỗi vị trí công việc ngoài danh mục vào trường jobPosition', async () => {
    const service = buildCrudService({ staffRow: STAFF_ROW });

    const error = await service
      .updateStaff('mgr-1', 'staff-1', {
        jobPosition: 'ADMIN' as JobPosition,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(errorBody(error)).toMatchObject({
      fields: ['jobPosition'],
      fieldErrors: {
        jobPosition: STAFF_VALIDATION_MESSAGES.JOB_POSITION_INVALID,
      },
    });
  });

  it('giữ nguyên lỗi hạ tầng của Prisma thay vì báo sai là không tìm thấy nhân viên', async () => {
    const service = buildCrudService({
      staffRow: STAFF_ROW,
      onUpdate: jest
        .fn()
        .mockRejectedValue({ code: 'P1001', message: 'cannot reach database' }),
    });

    const error = await service
      .updateStaff('mgr-1', 'staff-1', { firstName: 'Bình' })
      .catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(503);
    expect((error as HttpException).message).toBe(
      STAFF_MESSAGES.SERVICE_UNAVAILABLE,
    );
  });

  it('báo không tìm thấy khi Prisma không có bản ghi để cập nhật (P2025)', async () => {
    const service = buildCrudService({
      staffRow: STAFF_ROW,
      onUpdate: jest.fn().mockRejectedValue({ code: 'P2025' }),
    });

    const error = await service
      .updateStaff('mgr-1', 'staff-1', { firstName: 'Bình' })
      .catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(404);
    expect((error as HttpException).message).toBe(
      STAFF_MESSAGES.STAFF_NOT_FOUND,
    );
  });
});
