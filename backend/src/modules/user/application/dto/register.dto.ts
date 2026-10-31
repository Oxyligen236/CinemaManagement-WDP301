import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  AUTH_VALIDATION_MESSAGES as MSG,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  VERIFICATION_CODE_LENGTH,
} from '../../domain/constants/auth-message.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(trim)
  @IsEmail({}, { message: MSG.EMAIL_INVALID })
  @IsNotEmpty({ message: MSG.EMAIL_REQUIRED })
  email!: string;

  @IsString({ message: MSG.PASSWORD_REQUIRED })
  @IsNotEmpty({ message: MSG.PASSWORD_REQUIRED })
  @MinLength(PASSWORD_MIN_LENGTH, { message: MSG.PASSWORD_MIN })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: MSG.PASSWORD_MAX })
  password!: string;

  @Transform(trim)
  @IsString({ message: MSG.FIRST_NAME_REQUIRED })
  @IsNotEmpty({ message: MSG.FIRST_NAME_REQUIRED })
  @MaxLength(NAME_MAX_LENGTH, { message: MSG.FIRST_NAME_MAX })
  firstName!: string;

  @Transform(trim)
  @IsString({ message: MSG.LAST_NAME_REQUIRED })
  @IsNotEmpty({ message: MSG.LAST_NAME_REQUIRED })
  @MaxLength(NAME_MAX_LENGTH, { message: MSG.LAST_NAME_MAX })
  lastName!: string;
}

export class ResendVerificationDto {
  @Transform(trim)
  @IsEmail({}, { message: MSG.EMAIL_INVALID })
  @IsNotEmpty({ message: MSG.EMAIL_REQUIRED })
  email!: string;
}

/** Query tra cứu trạng thái đăng ký đang chờ xác thực của một email. */
export class VerificationStatusQueryReq {
  @Transform(trim)
  @IsEmail({}, { message: MSG.EMAIL_INVALID })
  @IsNotEmpty({ message: MSG.EMAIL_REQUIRED })
  email!: string;
}

export class VerifyEmailDto {
  @Transform(trim)
  @IsEmail({}, { message: MSG.EMAIL_INVALID })
  @IsNotEmpty({ message: MSG.EMAIL_REQUIRED })
  email!: string;

  @Transform(trim)
  @IsString({ message: MSG.CODE_REQUIRED })
  @Length(VERIFICATION_CODE_LENGTH, VERIFICATION_CODE_LENGTH, {
    message: MSG.CODE_LENGTH,
  })
  code!: string;
}
