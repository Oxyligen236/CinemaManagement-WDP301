import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

import {
  AUTH_VALIDATION_MESSAGES as MSG,
  PASSWORD_MIN_LENGTH,
} from '../../domain/constants/auth-message.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class LoginDto {
  @Transform(trim)
  @IsEmail({}, { message: MSG.EMAIL_INVALID })
  @IsNotEmpty({ message: MSG.EMAIL_REQUIRED })
  email!: string;

  @IsString({ message: MSG.PASSWORD_REQUIRED })
  @IsNotEmpty({ message: MSG.PASSWORD_REQUIRED })
  @MinLength(PASSWORD_MIN_LENGTH, { message: MSG.PASSWORD_MIN })
  password!: string;
}
