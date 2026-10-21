import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
// eslint-disable-next-line prettier/prettier
import {
  RegisterDto,
  VerifyEmailDto,
} from '../application/dto/register.dto';
import { LoginDto } from '../application/dto/login.dto';
import { UserAuthenticationService } from '../application/services/user-authentication.service';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../application/dto/forgot-password.dto';
import { PasswordResetService } from '../application/services/password-reset.service';
import { UserRegistrationService } from '../application/services/user-registration.service';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class UserController {
  constructor(
    private readonly userRegistrationService: UserRegistrationService,
    private readonly userAuthenticationService: UserAuthenticationService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.userRegistrationService.register(input);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() input: VerifyEmailDto) {
    return this.userRegistrationService.verifyEmail(input.email, input.code);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() input: LoginDto) {
    return this.userAuthenticationService.login(input.email, input.password);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.passwordResetService.requestReset(input.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(
      input.email,
      input.code,
      input.newPassword,
    );
  }
}
