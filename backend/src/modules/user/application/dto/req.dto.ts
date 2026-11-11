import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileReq {
  @IsOptional()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @IsString({ message: 'Tên phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'Tên không được vượt quá 50 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstName?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'Họ không được để trống' })
  @IsString({ message: 'Họ phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'Họ không được vượt quá 50 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastName?: string;
}

export class ChangePasswordReq {
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi ký tự' })
  currentPassword: string;

  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự' })
  @MinLength(8, { message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' })
  @MaxLength(64, { message: 'Mật khẩu mới không được vượt quá 64 ký tự' })
  newPassword: string;
}
