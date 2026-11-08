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
