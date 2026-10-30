/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  createHash,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

import { Role } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { UserRegisteredEvent } from '../../../auth/domain/events/user-registered.event';
import { UserCreatedEvent } from '../../domain/events/user-created.event';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import {
  PendingRegistrationService,
  PendingUser,
} from './pending-registration.service';
import { REGISTRATION_MESSAGES as MSG } from '../../domain/constants/auth-message.constants';

const CODE_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_RESENDS = 3;

@Injectable()
export class UserRegistrationService {
  private readonly logger = new Logger(UserRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,

    @Inject(INTERNAL_EVENT_BUS)
    private readonly eventBus: InternalEventBus,

    private readonly pendingRegistrations: PendingRegistrationService,
  ) {}

  private hashCode(email: string, code: string): string {
    return createHash('sha256').update(`${email}:${code}`).digest('hex');
  }

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    if (
      !input ||
      typeof input.email !== 'string' ||
      typeof input.password !== 'string' ||
      typeof input.firstName !== 'string' ||
      typeof input.lastName !== 'string'
    ) {
      throw new BadRequestException(MSG.INVALID_DATA);
    }

    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    if (!email || !input.password.trim() || !firstName || !lastName) {
      throw new BadRequestException(MSG.ALL_FIELDS_REQUIRED);
    }

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException(MSG.EMAIL_ALREADY_REGISTERED);
    }

    const existing = this.pendingRegistrations.get(email);
    if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        MSG.RESEND_COOLDOWN,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    await this.issueCode(
      {
        email,
        passwordHash,
        firstName,
        lastName,
        codeHash: '',
        expiresAt: 0,
        attempts: 0,
        lastSentAt: 0,
        resendCount: 0,
      },
      existing !== undefined,
    );

    return {
      message: 'Verification code sent',
      email,
      verificationExpiresInSeconds: CODE_TTL_SECONDS,
    };
  }

  private async issueCode(
    pending: PendingUser,
    isResend: boolean,
  ): Promise<void> {
    if (isResend) {
      if (pending.resendCount >= MAX_RESENDS) {
        throw new HttpException(
          MSG.RESEND_LIMIT_REACHED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      pending.resendCount += 1;
    }

    const previousBackup = { ...pending };
    const code = String(randomInt(100000, 1000000));
    const now = Date.now();

    pending.codeHash = this.hashCode(pending.email, code);
    pending.expiresAt = now + CODE_TTL_SECONDS * 1000;
    pending.attempts = 0;
    pending.lastSentAt = now;

    this.pendingRegistrations.save(pending.email, pending);

    try {
      await this.eventBus.publish(
        new UserRegisteredEvent(
          pending.email,
          code,
          CODE_TTL_SECONDS,
          `${pending.firstName} ${pending.lastName}`,
        ),
      );
    } catch (err) {
      if (!isResend) {
        this.pendingRegistrations.delete(pending.email);
      } else {
        this.pendingRegistrations.save(pending.email, previousBackup);
      }
      throw err;
    }
  }

  async resendVerificationCode(rawEmail: string) {
    return this.resendCode(rawEmail);
  }

  async verifyEmail(rawEmail: string, code: string) {
    return this.verifyCode(rawEmail, code);
  }

  async resendCode(rawEmail: string) {

    const email = String(rawEmail ?? '')
      .trim()
      .toLowerCase();
    const pending = this.pendingRegistrations.get(email);

    if (!pending) {
      throw new BadRequestException(MSG.NO_PENDING_REGISTRATION);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(MSG.EMAIL_ALREADY_REGISTERED);
    }

    if (Date.now() - pending.lastSentAt < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        MSG.RESEND_COOLDOWN,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.issueCode(pending, true);

    return {
      message: 'Verification code resent',
      email,
      verificationExpiresInSeconds: CODE_TTL_SECONDS,
    };
  }

  async verifyCode(rawEmail: string, code: string) {
    const email = String(rawEmail ?? '')
      .trim()
      .toLowerCase();
    const pending = this.pendingRegistrations.get(email);

    if (!pending) {
      throw new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED);
    }

    if (pending.attempts >= MAX_ATTEMPTS) {
      this.pendingRegistrations.delete(email);
      throw new BadRequestException(MSG.TOO_MANY_ATTEMPTS);
    }

    const provided = Buffer.from(this.hashCode(email, String(code ?? '')));
    const expected = Buffer.from(pending.codeHash);
    const ok =
      provided.length === expected.length &&
      timingSafeEqual(provided, expected);

    if (!ok) {
      pending.attempts += 1;
      throw new BadRequestException(MSG.CODE_INVALID_OR_EXPIRED);
    }

    let user: any;

    try {
      user = await this.prisma.user.create({
        data: {
          email,
          password: pending.passwordHash,
          firstName: pending.firstName,
          lastName: pending.lastName,
          role: Role.USER,
          isActive: true,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        this.pendingRegistrations.delete(email);
        throw new ConflictException(MSG.EMAIL_ALREADY_REGISTERED);
      }
      throw err;
    }

    this.pendingRegistrations.delete(email);

    try {
      await this.eventBus.publish(
        new UserCreatedEvent(
          user.email,
          `${pending.firstName} ${pending.lastName}`,
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to dispatch welcome email for ${user.email}`,
        err instanceof Error ? err.stack : err,
      );
    }

    return {
      message: 'Email verified, account created',
      userId: user.id,
      email: user.email,
    };
  }
}
