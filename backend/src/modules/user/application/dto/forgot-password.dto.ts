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
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  VERIFICATION_CODE_LENGTH,
} from '../../domain/constants/auth-message.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ForgotPasswordDto {
  @Transform(trim)
  @IsEmail({}, { message: MSG.EMAIL_INVALID })
  @IsNotEmpty({ message: MSG.EMAIL_REQUIRED })
  email!: string;
}

export class ResetPasswordDto {
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

  @IsString({ message: MSG.NEW_PASSWORD_REQUIRED })
  @IsNotEmpty({ message: MSG.NEW_PASSWORD_REQUIRED })
  @MinLength(PASSWORD_MIN_LENGTH, { message: MSG.NEW_PASSWORD_MIN })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: MSG.NEW_PASSWORD_MAX })
  newPassword!: string;
}
