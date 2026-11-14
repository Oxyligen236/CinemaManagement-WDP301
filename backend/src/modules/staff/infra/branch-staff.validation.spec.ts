import { HttpException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { JobPosition, EmploymentStatus } from '@prisma/client';
import {
  BranchStaffController,
  staffValidationPipe,
} from './branch-staff.controller';
import { BranchStaffService } from '../application/branch-staff.service';
import { AuthenticatedRequest } from '../../auth/domain/auth-user';
import {
  CreateBranchStaffDto,
  UpdateBranchStaffDto,
} from '../application/dto/branch-staff.dto';
import {
  STAFF_FIELD_LIMITS,
  STAFF_MESSAGES,
  STAFF_VALIDATION_MESSAGES as MSG,
} from '../domain/staff.rules';

const VALID_CREATE = {
  email: 'nhanvien@latte.vn',
  password: 'matkhau123',
  firstName: 'An',
  lastName: 'Nguyễn',
  jobPosition: JobPosition.TICKET_SELLER,
};

/**
 * Chạy body qua đúng pipe mà controller dùng và lấy thân response lỗi, tức là
 * dữ liệu giao diện thực sự nhận được.
 */
const validate = async (metatype: unknown, body: unknown) => {
  try {
    await staffValidationPipe.transform(body, {
      type: 'body',
      metatype: metatype as new () => unknown,
    });
    return null;
  } catch (error: unknown) {
    return (error as HttpException).getResponse() as {
      message: string;
      errors: string[];
      fields: string[];
      fieldErrors: Record<string, string>;
    };
  }
};

describe('staffValidationPipe - CreateBranchStaffDto', () => {
  it('cho qua dữ liệu hợp lệ', async () => {
    await expect(validate(CreateBranchStaffDto, VALID_CREATE)).resolves.toBe(
      null,
    );
  });

  it.each([
    ['email', { email: '' }, MSG.EMAIL_REQUIRED],
    ['email', { email: 'minh@gmail' }, MSG.EMAIL_INVALID],
    ['email', { email: `${'a'.repeat(250)}@latte.vn` }, MSG.EMAIL_MAX],
    ['password', { password: '' }, MSG.PASSWORD_REQUIRED],
    ['password', { password: 'ngan12' }, MSG.PASSWORD_MIN],
    [
      'password',
      { password: 'a'.repeat(STAFF_FIELD_LIMITS.PASSWORD_MAX + 1) },
      MSG.PASSWORD_MAX,
    ],
    ['firstName', { firstName: '   ' }, MSG.FIRST_NAME_REQUIRED],
    [
      'firstName',
      { firstName: 'a'.repeat(STAFF_FIELD_LIMITS.NAME_MAX + 1) },
      MSG.FIRST_NAME_MAX,
    ],
    ['lastName', { lastName: '' }, MSG.LAST_NAME_REQUIRED],
    [
      'lastName',
      { lastName: 'a'.repeat(STAFF_FIELD_LIMITS.NAME_MAX + 1) },
      MSG.LAST_NAME_MAX,
    ],
    ['jobPosition', { jobPosition: '' }, MSG.JOB_POSITION_REQUIRED],
    ['jobPosition', { jobPosition: 'ADMIN' }, MSG.JOB_POSITION_INVALID],
    [
      'employmentStatus',
      { employmentStatus: EmploymentStatus.RESIGNED },
      MSG.EMPLOYMENT_STATUS_NOT_CREATABLE,
    ],
  ])(
    'trả thông báo tiếng Việt gắn với trường %s',
    async (field, patch, expected) => {
      const body = await validate(CreateBranchStaffDto, {
        ...VALID_CREATE,
        ...patch,
      });

      expect(body?.fieldErrors).toEqual({ [field]: expected });
      expect(body?.fields).toEqual([field]);
      // Chỉ sai một trường thì banner chung cũng nêu đúng lý do.
      expect(body?.message).toBe(expected);
    },
  );

  it('báo thiếu cho mọi trường bắt buộc khi body rỗng', async () => {
    const body = await validate(CreateBranchStaffDto, {});

    expect(body?.fieldErrors).toEqual({
      email: MSG.EMAIL_REQUIRED,
      password: MSG.PASSWORD_REQUIRED,
      firstName: MSG.FIRST_NAME_REQUIRED,
      lastName: MSG.LAST_NAME_REQUIRED,
      jobPosition: MSG.JOB_POSITION_REQUIRED,
    });
    // Nhiều trường sai thì banner chung quay về câu tổng quát MSG01.
    expect(body?.message).toBe(STAFF_MESSAGES.MSG01);
  });

  it('cắt khoảng trắng đầu/cuối trước khi kiểm tra độ dài tên', async () => {
    await expect(
      validate(CreateBranchStaffDto, { ...VALID_CREATE, firstName: '  An  ' }),
    ).resolves.toBe(null);
  });
});

describe('staffValidationPipe - UpdateBranchStaffDto', () => {
  it('cho qua khi chỉ cập nhật một trường', async () => {
    await expect(
      validate(UpdateBranchStaffDto, { firstName: 'Bình' }),
    ).resolves.toBe(null);
  });

  it.each([
    ['firstName', { firstName: '' }, MSG.FIRST_NAME_REQUIRED],
    [
      'firstName',
      { firstName: 'a'.repeat(STAFF_FIELD_LIMITS.NAME_MAX + 1) },
      MSG.FIRST_NAME_MAX,
    ],
    ['lastName', { lastName: '  ' }, MSG.LAST_NAME_REQUIRED],
    [
      'lastName',
      { lastName: 'a'.repeat(STAFF_FIELD_LIMITS.NAME_MAX + 1) },
      MSG.LAST_NAME_MAX,
    ],
    ['jobPosition', { jobPosition: '' }, MSG.JOB_POSITION_REQUIRED],
    ['jobPosition', { jobPosition: 'ADMIN' }, MSG.JOB_POSITION_INVALID],
    [
      'employmentStatus',
      { employmentStatus: 'UNKNOWN' },
      MSG.EMPLOYMENT_STATUS_INVALID,
    ],
  ])(
    'trả thông báo tiếng Việt gắn với trường %s',
    async (field, patch, expected) => {
      const body = await validate(UpdateBranchStaffDto, patch);

      expect(body?.fieldErrors).toEqual({ [field]: expected });
      expect(body?.message).toBe(expected);
    },
  );

  it('cho phép chuyển sang trạng thái đã nghỉ việc (BR-BRM-15)', async () => {
    await expect(
      validate(UpdateBranchStaffDto, {
        employmentStatus: EmploymentStatus.RESIGNED,
      }),
    ).resolves.toBe(null);
  });

  it('gom cả lỗi từ nested ValidationError children khi gọi exceptionFactory', () => {
    const factory = (
      staffValidationPipe as unknown as {
        exceptionFactory: (errors: ValidationError[]) => HttpException;
      }
    ).exceptionFactory;

    const nestedErr: ValidationError = {
      property: 'profile',
      children: [
        {
          property: 'firstName',
          constraints: { isNotEmpty: 'Thiếu tên', maxLength: 'Quá dài' },
          children: [],
        },
        {
          property: 'emptyNode',
          children: [],
        },
      ],
    };

    const res = factory([nestedErr]).getResponse() as {
      message: string;
      fields: string[];
      fieldErrors: Record<string, string>;
    };

    expect(res.fields).toEqual(['profile.firstName']);
    expect(res.fieldErrors).toEqual({ 'profile.firstName': 'Thiếu tên' });
    expect(res.message).toBe('Thiếu tên');
  });
});

describe('BranchStaffController', () => {
  let controller: BranchStaffController;
  let mockService: jest.Mocked<BranchStaffService>;
  const req = { user: { sub: 'mgr-1' } } as unknown as AuthenticatedRequest;

  beforeEach(() => {
    mockService = {
      getOptions: jest.fn(),
      listStaff: jest.fn(),
      getStaff: jest.fn(),
      createStaff: jest.fn(),
      updateStaff: jest.fn(),
    } as unknown as jest.Mocked<BranchStaffService>;
    controller = new BranchStaffController(mockService);
  });

  it('getOptions gọi branchStaffService.getOptions với managerUserId', async () => {
    mockService.getOptions.mockResolvedValue({ ok: true } as any);
    const res = await controller.getOptions(req);
    expect(mockService.getOptions).toHaveBeenCalledWith('mgr-1');
    expect(res).toEqual({ ok: true });
  });

  it('listStaff gọi branchStaffService.listStaff với managerUserId và query', async () => {
    const query = { search: 'An' };
    mockService.listStaff.mockResolvedValue({ total: 0 } as any);
    const res = await controller.listStaff(req, query);
    expect(mockService.listStaff).toHaveBeenCalledWith('mgr-1', query);
    expect(res).toEqual({ total: 0 });
  });

  it('getStaff gọi branchStaffService.getStaff với managerUserId và userId', async () => {
    mockService.getStaff.mockResolvedValue({ staff: { userId: 's-1' } } as any);
    const res = await controller.getStaff(req, 's-1');
    expect(mockService.getStaff).toHaveBeenCalledWith('mgr-1', 's-1');
    expect(res).toEqual({ staff: { userId: 's-1' } });
  });

  it('createStaff gọi branchStaffService.createStaff với managerUserId và body', async () => {
    const dto = { ...VALID_CREATE } as CreateBranchStaffDto;
    mockService.createStaff.mockResolvedValue({ message: 'ok' } as any);
    const res = await controller.createStaff(req, dto);
    expect(mockService.createStaff).toHaveBeenCalledWith('mgr-1', dto);
    expect(res).toEqual({ message: 'ok' });
  });

  it('updateStaff gọi branchStaffService.updateStaff với managerUserId, userId và body', async () => {
    const dto = { firstName: 'Bình' } as UpdateBranchStaffDto;
    mockService.updateStaff.mockResolvedValue({ message: 'updated' } as any);
    const res = await controller.updateStaff(req, 's-1', dto);
    expect(mockService.updateStaff).toHaveBeenCalledWith('mgr-1', 's-1', dto);
    expect(res).toEqual({ message: 'updated' });
  });
});
