/* eslint-disable prettier/prettier */
import { Transform } from 'class-transformer';
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
} from '../../domain/staff.rules';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BranchStaffQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(JobPosition)
  jobPosition?: JobPosition;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;
}

/**
 * BR-BRM-13: thông tin bắt buộc khi tạo tài khoản nhân viên.
 * Không có branchId / role trong DTO: hệ thống tự gán chi nhánh của
 * Branch Manager và vai trò STAFF (whitelist sẽ loại bỏ nếu client gửi lên).
 */
export class CreateBranchStaffDto {
  @Transform(trim)
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  /** BR-BRM-14 */
  @IsIn(BRANCH_ASSIGNABLE_POSITIONS)
  jobPosition!: JobPosition;

  /** BR-BRM-14 - mặc định ACTIVE */
  @IsOptional()
  @IsIn(CREATABLE_STATUSES)
  employmentStatus?: EmploymentStatus;
}

/**
 * Cập nhật thông tin, vị trí và trạng thái làm việc.
 * Email (tên đăng nhập), vai trò và chi nhánh không được thay đổi ở đây.
 */
export class UpdateBranchStaffDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  /** BR-BRM-14 */
  @IsOptional()
  @IsIn(BRANCH_ASSIGNABLE_POSITIONS)
  jobPosition?: JobPosition;

  /** BR-BRM-15 */
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;
}
