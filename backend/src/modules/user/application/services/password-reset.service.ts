import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { User, UserDocument } from '../../domain/schemas/user.schema';
import {
  MAIL_SERVICE,
  MailService,
} from '../../../infra/mail/application/interface/mail-service.interface';
import { PASSWORD_RESET_MESSAGES as MSG } from '../../domain/constants/auth-message.constants';

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

interface PasswordResetRequest {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

@Injectable()
export class PasswordResetService {
  private readonly resetRequests = new Map<string, PasswordResetRequest>();

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @Inject(MAIL_SERVICE)
    private readonly mailService: MailService,
  ) {}

  private hashCode(email: string, code: string): string {
    return createHash('sha256').update(`${email}:${code}`).digest('hex');
  }

  private removeExpiredRequest(email: string): void {
    const request = this.resetRequests.get(email);

    if (request && request.expiresAt <= Date.now()) {
      this.resetRequests.delete(email);
    }
  }

  async requestReset(rawEmail: string) {
    const email = String(rawEmail ?? '')
      .trim()
      .toLowerCase();

    if (!email) {
      throw new BadRequestException(MSG.EMAIL_REQUIRED);
    }

    const response = {
      message:
        'If an account exists with this email, a password reset code has been sent',
      resetCodeExpiresInSeconds: 300,
    };

    const user = await this.userModel
      .findOne({ email })
      .select('firstName')
      .lean()
      .exec();

    if (!user) {
      return response;
    }

    this.removeExpiredRequest(email);

    const existingRequest = this.resetRequests.get(email);

    if (
      existingRequest &&
      Date.now() - existingRequest.lastSentAt < RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        MSG.RESEND_COOLDOWN,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(100000, 1000000));
    const now = Date.now();

    this.resetRequests.set(email, {
      email,
      codeHash: this.hashCode(email, code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    });

    try {
      await this.mailService.sendMail({
        to: email,
        subject: 'Đặt lại mật khẩu - Mã OTP',
        template: 'password-reset',
        context: {
          name: user.firstName || email,
          code,
          expiresInMinutes: 5,
        },
      });
    } catch (error) {
      this.resetRequests.delete(email);
      throw error;
    }

    return response;
  }

  async resetPassword(rawEmail: string, rawCode: string, newPassword: string) {
    const email = String(rawEmail ?? '')
      .trim()
      .toLowerCase();
    const code = String(rawCode ?? '').trim();

    if (!email || !/^\d{6}$/.test(code)) {
      throw new BadRequestException(MSG.EMAIL_AND_CODE_REQUIRED);
    }

    if (!newPassword || newPassword.trim().length < 8) {
      throw new BadRequestException(MSG.NEW_PASSWORD_MIN);
    }

    this.removeExpiredRequest(email);

    const request = this.resetRequests.get(email);

    if (!request) {
      throw new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED);
    }

    if (request.attempts >= MAX_ATTEMPTS) {
      this.resetRequests.delete(email);

      throw new BadRequestException(MSG.TOO_MANY_ATTEMPTS);
    }

    const expectedHash = Buffer.from(request.codeHash);
    const providedHash = Buffer.from(this.hashCode(email, code));

    const validCode =
      expectedHash.length === providedHash.length &&
      timingSafeEqual(expectedHash, providedHash);

    if (!validCode) {
      request.attempts += 1;

      throw new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await this.userModel.updateOne(
      { email },
      {
        $set: {
          password: passwordHash,
        },
      },
    );

    if (result.matchedCount === 0) {
      this.resetRequests.delete(email);

      throw new BadRequestException(MSG.ACCOUNT_NOT_FOUND);
    }

    this.resetRequests.delete(email);

    return {
      message: 'Password has been reset successfully',
    };
  }
}
