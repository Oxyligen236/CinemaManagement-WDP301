import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '../../auth/domain/types/authenticated-user.type';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../application/dto/forgot-password.dto';
import { LoginDto } from '../application/dto/login.dto';
import {
  RegisterDto,
  ResendVerificationDto,
  VerificationStatusQueryReq,
  VerifyEmailDto,
} from '../application/dto/register.dto';
import {
  ChangePasswordReq,
  UpdateProfileReq,
} from '../application/dto/req.dto';
import { UserProfileRes } from '../application/dto/res.dto';
import { ChangePasswordService } from '../application/services/change-password.service';
import { PasswordResetService } from '../application/services/password-reset.service';
import { UserAuthenticationService } from '../application/services/user-authentication.service';
import { UserProfileCommandService } from '../application/services/user-profile-command.service';
import { UserProfileQueryService } from '../application/services/user-profile-query.service';
import { UserRegistrationService } from '../application/services/user-registration.service';
import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;
  let userRegistrationService: {
    register: jest.Mock;
    getVerificationStatus: jest.Mock;
    resendCode: jest.Mock;
    verifyCode: jest.Mock;
  };
  let userAuthenticationService: { login: jest.Mock };
  let passwordResetService: {
    requestReset: jest.Mock;
    resetPassword: jest.Mock;
  };
  let userProfileQueryService: { execute: jest.Mock };
  let userProfileCommandService: { execute: jest.Mock };
  let changePasswordService: { execute: jest.Mock };

  const currentUser = {
    userId: 'user-1',
    email: 'user@cinema.local',
    role: 'USER',
  } as AuthenticatedUser;

  beforeEach(async () => {
    userRegistrationService = {
      register: jest.fn(),
      getVerificationStatus: jest.fn(),
      resendCode: jest.fn(),
      verifyCode: jest.fn(),
    };
    userAuthenticationService = { login: jest.fn() };
    passwordResetService = {
      requestReset: jest.fn(),
      resetPassword: jest.fn(),
    };
    userProfileQueryService = { execute: jest.fn() };
    userProfileCommandService = { execute: jest.fn() };
    changePasswordService = { execute: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserRegistrationService, useValue: userRegistrationService },
        {
          provide: UserAuthenticationService,
          useValue: userAuthenticationService,
        },
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: UserProfileQueryService, useValue: userProfileQueryService },
        {
          provide: UserProfileCommandService,
          useValue: userProfileCommandService,
        },
        { provide: ChangePasswordService, useValue: changePasswordService },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(UserController);
  });

  it('register delegates to userRegistrationService.register', async () => {
    const dto: RegisterDto = {
      email: 'u@cinema.local',
      password: 'Password123!',
      firstName: 'Minh',
      lastName: 'Nguyen',
    };
    const expected = { email: 'u@cinema.local' };
    userRegistrationService.register.mockResolvedValue(expected);

    await expect(controller.register(dto)).resolves.toBe(expected);
    expect(userRegistrationService.register).toHaveBeenCalledWith(dto);
  });

  it('verificationStatus delegates query.email to userRegistrationService.getVerificationStatus', async () => {
    const query: VerificationStatusQueryReq = { email: 'u@cinema.local' };
    const expected = { email: 'u@cinema.local', pending: true };
    userRegistrationService.getVerificationStatus.mockResolvedValue(expected);

    await expect(controller.verificationStatus(query)).resolves.toBe(expected);
    expect(userRegistrationService.getVerificationStatus).toHaveBeenCalledWith(
      'u@cinema.local',
    );
  });

  it('resendVerification delegates input.email to userRegistrationService.resendCode', async () => {
    const dto: ResendVerificationDto = { email: 'u@cinema.local' };
    const expected = { email: 'u@cinema.local' };
    userRegistrationService.resendCode.mockResolvedValue(expected);

    await expect(controller.resendVerification(dto)).resolves.toBe(expected);
    expect(userRegistrationService.resendCode).toHaveBeenCalledWith(
      'u@cinema.local',
    );
  });

  it('verifyEmail delegates email and code to userRegistrationService.verifyCode', async () => {
    const dto: VerifyEmailDto = { email: 'u@cinema.local', code: '123456' };
    const expected = { message: 'Email verified, account created' };
    userRegistrationService.verifyCode.mockResolvedValue(expected);

    await expect(controller.verifyEmail(dto)).resolves.toBe(expected);
    expect(userRegistrationService.verifyCode).toHaveBeenCalledWith(
      'u@cinema.local',
      '123456',
    );
  });

  it('login delegates email and password to userAuthenticationService.login', async () => {
    const dto: LoginDto = {
      email: 'u@cinema.local',
      password: 'Password123!',
    };
    const expected = { accessToken: 'jwt' };
    userAuthenticationService.login.mockResolvedValue(expected);

    await expect(controller.login(dto)).resolves.toBe(expected);
    expect(userAuthenticationService.login).toHaveBeenCalledWith(
      'u@cinema.local',
      'Password123!',
    );
  });

  it('forgotPassword delegates input.email to passwordResetService.requestReset', async () => {
    const dto: ForgotPasswordDto = { email: 'u@cinema.local' };
    const expected = { resetCodeExpiresInSeconds: 300 };
    passwordResetService.requestReset.mockResolvedValue(expected);

    await expect(controller.forgotPassword(dto)).resolves.toBe(expected);
    expect(passwordResetService.requestReset).toHaveBeenCalledWith(
      'u@cinema.local',
    );
  });

  it('resetPassword delegates email, code, and newPassword to passwordResetService.resetPassword', async () => {
    const dto: ResetPasswordDto = {
      email: 'u@cinema.local',
      code: '123456',
      newPassword: 'NewPassword123!',
    };
    const expected = { message: 'Password has been reset successfully' };
    passwordResetService.resetPassword.mockResolvedValue(expected);

    await expect(controller.resetPassword(dto)).resolves.toBe(expected);
    expect(passwordResetService.resetPassword).toHaveBeenCalledWith(
      'u@cinema.local',
      '123456',
      'NewPassword123!',
    );
  });

  it('getProfile delegates currentUser.userId to userProfileQueryService.execute', async () => {
    const expected = { id: 'user-1' } as UserProfileRes;
    userProfileQueryService.execute.mockResolvedValue(expected);

    await expect(controller.getProfile(currentUser)).resolves.toBe(expected);
    expect(userProfileQueryService.execute).toHaveBeenCalledWith('user-1');
  });

  it('updateProfile delegates currentUser.userId and dto to userProfileCommandService.execute', async () => {
    const dto: UpdateProfileReq = { firstName: 'An', lastName: 'Le' };
    const expected = { id: 'user-1', firstName: 'An' } as UserProfileRes;
    userProfileCommandService.execute.mockResolvedValue(expected);

    await expect(controller.updateProfile(currentUser, dto)).resolves.toBe(
      expected,
    );
    expect(userProfileCommandService.execute).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });

  it('changePassword delegates currentUser.userId and dto to changePasswordService.execute', async () => {
    const dto: ChangePasswordReq = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
    };
    const expected = { message: 'Đổi mật khẩu thành công' };
    changePasswordService.execute.mockResolvedValue(expected);

    await expect(controller.changePassword(currentUser, dto)).resolves.toBe(
      expected,
    );
    expect(changePasswordService.execute).toHaveBeenCalledWith('user-1', dto);
  });
});
