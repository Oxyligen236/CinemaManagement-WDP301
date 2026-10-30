import { HttpException } from '@nestjs/common';
import { JobPosition, EmploymentStatus } from '@prisma/client';
import { staffValidationPipe } from './branch-staff.controller';
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
});
