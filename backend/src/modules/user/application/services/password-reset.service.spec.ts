import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { SendMailOptions } from '../../../infra/mail/application/interface/mail-service.interface';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { PASSWORD_RESET_MESSAGES as MSG } from '../../domain/constants/auth-message.constants';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let mockMailService: {
    sendMail: jest.MockedFunction<(options: SendMailOptions) => Promise<void>>;
  };

  const extractCode = (callIndex = 0): string => {
    const context = mockMailService.sendMail.mock.calls[callIndex][0]
      .context as { code: string };
    return context.code;
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    mockMailService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    service = new PasswordResetService(
      mockPrisma as unknown as PrismaService,
      mockMailService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestReset', () => {
    it('throws BadRequestException when email is empty, whitespace, or nullish', async () => {
      await expect(service.requestReset('')).rejects.toThrow(
        new BadRequestException(MSG.EMAIL_REQUIRED),
      );
      await expect(service.requestReset('   ')).rejects.toThrow(
        new BadRequestException(MSG.EMAIL_REQUIRED),
      );
      await expect(
        service.requestReset(null as unknown as string),
      ).rejects.toThrow(new BadRequestException(MSG.EMAIL_REQUIRED));
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns generic success response without sending email when account does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await service.requestReset('  Unknown@Cinema.Local ');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'unknown@cinema.local' },
        select: { firstName: true },
      });
      expect(mockMailService.sendMail).not.toHaveBeenCalled();
      expect(res).toEqual({
        message:
          'If an account exists with this email, a password reset code has been sent',
        resetCodeExpiresInSeconds: 300,
      });
    });

    it('sends OTP email using user firstName and falls back to email when firstName is empty', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ firstName: 'Minh' });

      const res = await service.requestReset('User@Cinema.Local');

      expect(res.resetCodeExpiresInSeconds).toBe(300);
      expect(mockMailService.sendMail).toHaveBeenCalledWith({
        to: 'user@cinema.local',
        subject: 'Đặt lại mật khẩu - Mã OTP',
        template: 'password-reset',
        context: {
          name: 'Minh',
          code: expect.stringMatching(/^\d{6}$/) as string,
          expiresInMinutes: 5,
        },
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({ firstName: '' });
      await service.requestReset('nofirst@cinema.local');
      expect(mockMailService.sendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            name: 'nofirst@cinema.local',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('enforces 60s resend cooldown and allows resend after cooldown elapses', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Minh' });

      await service.requestReset('user@cinema.local');

      now += 30_000;
      await expect(service.requestReset('user@cinema.local')).rejects.toThrow(
        new HttpException(MSG.RESEND_COOLDOWN, HttpStatus.TOO_MANY_REQUESTS),
      );
      expect(mockMailService.sendMail).toHaveBeenCalledTimes(1);

      now += 31_000;
      await service.requestReset('user@cinema.local');
      expect(mockMailService.sendMail).toHaveBeenCalledTimes(2);
    });

    it('removes expired request and allows issuing a new code after expiration', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Minh' });

      await service.requestReset('user@cinema.local');

      now += 5 * 60 * 1000 + 1;
      await service.requestReset('user@cinema.local');

      expect(mockMailService.sendMail).toHaveBeenCalledTimes(2);
    });

    it('deletes stored reset request and rethrows when sendMail fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Minh' });
      mockMailService.sendMail.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(service.requestReset('user@cinema.local')).rejects.toThrow(
        'SMTP down',
      );

      // Immediate retry should succeed because failed request was cleaned up
      mockMailService.sendMail.mockResolvedValueOnce(undefined);
      await expect(
        service.requestReset('user@cinema.local'),
      ).resolves.toMatchObject({ resetCodeExpiresInSeconds: 300 });
    });
  });

  describe('resetPassword', () => {
    it('validates email, 6-digit code format, and newPassword minimum length', async () => {
      await expect(
        service.resetPassword('', '123456', 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.EMAIL_AND_CODE_REQUIRED));

      await expect(
        service.resetPassword(
          null as unknown as string,
          null as unknown as string,
          'NewPass123!',
        ),
      ).rejects.toThrow(new BadRequestException(MSG.EMAIL_AND_CODE_REQUIRED));

      await expect(
        service.resetPassword('user@cinema.local', '12ab56', 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.EMAIL_AND_CODE_REQUIRED));

      await expect(
        service.resetPassword('user@cinema.local', '123456', ''),
      ).rejects.toThrow(new BadRequestException(MSG.NEW_PASSWORD_MIN));

      await expect(
        service.resetPassword('user@cinema.local', '123456', '  short  '),
      ).rejects.toThrow(new BadRequestException(MSG.NEW_PASSWORD_MIN));
    });

    it('throws CODE_INVALID_OR_EXPIRED when no request exists or request has expired', async () => {
      await expect(
        service.resetPassword('nobody@cinema.local', '123456', 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED));

      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Minh' });

      await service.requestReset('user@cinema.local');
      const code = extractCode(0);

      now += 5 * 60 * 1000;
      await expect(
        service.resetPassword('user@cinema.local', code, 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED));
    });

    it('increments attempts on wrong code and locks request after 5 failed attempts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Minh' });
      await service.requestReset('user@cinema.local');
      const validCode = extractCode(0);
      const wrongCode = validCode === '000000' ? '999999' : '000000';

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.resetPassword('user@cinema.local', wrongCode, 'NewPass123!'),
        ).rejects.toThrow(new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED));
      }

      await expect(
        service.resetPassword('user@cinema.local', validCode, 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.TOO_MANY_ATTEMPTS));

      await expect(
        service.resetPassword('user@cinema.local', validCode, 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED));
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('deletes request and throws ACCOUNT_NOT_FOUND when prisma.user.update fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Minh' });
      await service.requestReset('user@cinema.local');
      const code = extractCode(0);

      mockPrisma.user.update.mockRejectedValueOnce(new Error('P2025'));

      await expect(
        service.resetPassword('user@cinema.local', code, 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.ACCOUNT_NOT_FOUND));

      // Request was cleared after DB error
      await expect(
        service.resetPassword('user@cinema.local', code, 'NewPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED));
    });

    it('hashes new password, updates user, clears reset request, and returns success message', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Minh' });
      await service.requestReset('User@Cinema.Local');
      const code = extractCode(0);

      mockPrisma.user.update.mockResolvedValueOnce({ id: 'u-1' });

      const result = await service.resetPassword(
        ' USER@CINEMA.LOCAL ',
        ` ${code} `,
        'NewPassword123!',
      );

      expect(result).toEqual({
        message: 'Password has been reset successfully',
      });
      const updateCalls = mockPrisma.user.update.mock.calls as Array<
        [{ where: { email: string }; data: { password: string } }]
      >;
      expect(updateCalls[0][0].where).toEqual({ email: 'user@cinema.local' });
      const updatedHash = updateCalls[0][0].data.password;
      await expect(
        bcrypt.compare('NewPassword123!', updatedHash),
      ).resolves.toBe(true);

      // Cannot reuse code after successful reset
      await expect(
        service.resetPassword('user@cinema.local', code, 'AnotherPass123!'),
      ).rejects.toThrow(new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED));
    });
  });
});
