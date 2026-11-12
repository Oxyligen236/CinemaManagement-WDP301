import { Transform } from 'class-transformer';
import { BranchStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { JobPosition } from '../../../user/domain/enums/job-position.enum';
import { EmploymentStatus } from '../../../user/domain/enums/employment-status.enum';
import {
  BRANCH_ASSIGNABLE_POSITIONS,
  CREATABLE_STATUSES,
  STAFF_FIELD_LIMITS as LIMITS,
  STAFF_VALIDATION_MESSAGES as MSG,
} from '../../domain/staff.rules';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BranchStaffQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: MSG.SEARCH_MAX })
  @MaxLength(LIMITS.SEARCH_MAX, { message: MSG.SEARCH_MAX })
  search?: string;

  @IsOptional()
  @IsEnum(JobPosition, { message: MSG.JOB_POSITION_INVALID })
  jobPosition?: JobPosition;

  @IsOptional()
  @IsEnum(EmploymentStatus, { message: MSG.EMPLOYMENT_STATUS_INVALID })
  employmentStatus?: EmploymentStatus;
}

/**
 * BR-BRM-13: thông tin bắt buộc khi tạo tài khoản nhân viên.
 * Không có branchId / role trong DTO: hệ thống tự gán chi nhánh của
 * Branch Manager và vai trò STAFF (whitelist sẽ loại bỏ nếu client gửi lên).
 */
export class CreateBranchStaffDto {
  @Transform(trim)
  @IsString({ message: MSG.EMAIL_REQUIRED })
  @IsNotEmpty({ message: MSG.EMAIL_REQUIRED })
  @IsEmail({}, { message: MSG.EMAIL_INVALID })
  @MaxLength(LIMITS.EMAIL_MAX, { message: MSG.EMAIL_MAX })
  email!: string;

  // MaxLength bám theo giới hạn 72 byte của bcrypt: chuỗi dài hơn bị cắt âm
  // thầm khi hash, nên phải chặn ngay tại đây thay vì nhận rồi hash sai.
  @IsString({ message: MSG.PASSWORD_REQUIRED })
  @IsNotEmpty({ message: MSG.PASSWORD_REQUIRED })
  @MinLength(LIMITS.PASSWORD_MIN, { message: MSG.PASSWORD_MIN })
  @MaxLength(LIMITS.PASSWORD_MAX, { message: MSG.PASSWORD_MAX })
  password!: string;

  @Transform(trim)
  @IsString({ message: MSG.FIRST_NAME_REQUIRED })
  @IsNotEmpty({ message: MSG.FIRST_NAME_REQUIRED })
  @MaxLength(LIMITS.NAME_MAX, { message: MSG.FIRST_NAME_MAX })
  firstName!: string;

  @Transform(trim)
  @IsString({ message: MSG.LAST_NAME_REQUIRED })
  @IsNotEmpty({ message: MSG.LAST_NAME_REQUIRED })
  @MaxLength(LIMITS.NAME_MAX, { message: MSG.LAST_NAME_MAX })
  lastName!: string;

  /** BR-BRM-14 */
  @IsNotEmpty({ message: MSG.JOB_POSITION_REQUIRED })
  @IsIn(BRANCH_ASSIGNABLE_POSITIONS, { message: MSG.JOB_POSITION_INVALID })
  jobPosition!: JobPosition;

  /** BR-BRM-14 - mặc định ACTIVE */
  @IsOptional()
  @IsIn(CREATABLE_STATUSES, {
    message: MSG.EMPLOYMENT_STATUS_NOT_CREATABLE,
  })
  employmentStatus?: EmploymentStatus;
}

/**
 * Cập nhật thông tin, vị trí và trạng thái làm việc.
 * Email (tên đăng nhập), vai trò và chi nhánh không được thay đổi ở đây.
 */
export class UpdateBranchStaffDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: MSG.FIRST_NAME_REQUIRED })
  @IsNotEmpty({ message: MSG.FIRST_NAME_REQUIRED })
  @MaxLength(LIMITS.NAME_MAX, { message: MSG.FIRST_NAME_MAX })
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: MSG.LAST_NAME_REQUIRED })
  @IsNotEmpty({ message: MSG.LAST_NAME_REQUIRED })
  @MaxLength(LIMITS.NAME_MAX, { message: MSG.LAST_NAME_MAX })
  lastName?: string;

  /** BR-BRM-14 */
  @IsOptional()
  @IsNotEmpty({ message: MSG.JOB_POSITION_REQUIRED })
  @IsIn(BRANCH_ASSIGNABLE_POSITIONS, { message: MSG.JOB_POSITION_INVALID })
  jobPosition?: JobPosition;

  /** BR-BRM-15 */
  @IsOptional()
  @IsEnum(EmploymentStatus, { message: MSG.EMPLOYMENT_STATUS_INVALID })
  employmentStatus?: EmploymentStatus;
}

export class BranchStaffItemDto {
  userId!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  branchId!: string;
  jobPosition?: string | null;
  employmentStatus!: string;
  isActive!: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  static of(params: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    branchId: string;
    jobPosition?: string | null;
    employmentStatus: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): BranchStaffItemDto {
    const res = new BranchStaffItemDto();
    Object.assign(res, params);
    return res;
  }
}

export class BranchStaffManagerBranchDto {
  branchId!: string;
  branchName!: string;
  address!: string;
  branchStatus!: BranchStatus;

  static of(
    branchId: string,
    branchName: string,
    address: string,
    branchStatus: BranchStatus,
  ): BranchStaffManagerBranchDto {
    const res = new BranchStaffManagerBranchDto();
    Object.assign(res, { branchId, branchName, address, branchStatus });
    return res;
  }
}

export class BranchStaffOptionsResDto {
  branch!: BranchStaffManagerBranchDto;
  jobPositions!: string[];
  employmentStatuses!: string[];
  creatableStatuses!: string[];

  static of(
    branch: BranchStaffManagerBranchDto,
    jobPositions: readonly string[] | string[],
    employmentStatuses: readonly string[] | string[],
    creatableStatuses: readonly string[] | string[],
  ): BranchStaffOptionsResDto {
    const res = new BranchStaffOptionsResDto();
    Object.assign(res, {
      branch,
      jobPositions: [...jobPositions],
      employmentStatuses: [...employmentStatuses],
      creatableStatuses: [...creatableStatuses],
    });
    return res;
  }
}

export class BranchStaffListResDto {
  branch!: BranchStaffManagerBranchDto;
  staff!: BranchStaffItemDto[];
  total!: number;

  static of(
    branch: BranchStaffManagerBranchDto,
    staff: BranchStaffItemDto[],
    total: number,
  ): BranchStaffListResDto {
    const res = new BranchStaffListResDto();
    Object.assign(res, { branch, staff, total });
    return res;
  }
}

export class BranchStaffDetailResDto {
  branch!: BranchStaffManagerBranchDto;
  staff!: BranchStaffItemDto;

  static of(
    branch: BranchStaffManagerBranchDto,
    staff: BranchStaffItemDto,
  ): BranchStaffDetailResDto {
    const res = new BranchStaffDetailResDto();
    Object.assign(res, { branch, staff });
    return res;
  }
}

export class BranchStaffMutationResDto {
  message!: string;
  staff!: BranchStaffItemDto;

  static of(
    message: string,
    staff: BranchStaffItemDto,
  ): BranchStaffMutationResDto {
    const res = new BranchStaffMutationResDto();
    Object.assign(res, { message, staff });
    return res;
  }
}
