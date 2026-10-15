/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { User, UserDocument } from '../../domain/schemas/user.schema';
import { Role } from '../../domain/enums/role.enum';
import { UserRegisteredEvent } from '../../../auth/domain/events/user-registered.event';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { PendingRegistrationService } from './pending-registration.service';

const CODE_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class UserRegistrationService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

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
      throw new BadRequestException('Invalid registration data');
    }

    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    if (!email || !input.password.trim() || !firstName || !lastName) {
      throw new BadRequestException('All fields are required');
    }

    if (await this.userModel.exists({ email })) {
      throw new ConflictException('Email is already registered');
    }

    const existing = this.pendingRegistrations.get(email);
    if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(100000, 1000000));
    const passwordHash = await bcrypt.hash(input.password, 10);
    const now = Date.now();

    this.pendingRegistrations.save(email, {
      email,
      passwordHash,
      firstName,
      lastName,
      codeHash: this.hashCode(email, code),
      expiresAt: now + CODE_TTL_SECONDS * 1000,
      attempts: 0,
      lastSentAt: now,
    });

    try {
      await this.eventBus.publish(
        new UserRegisteredEvent(
          email,
          code,
          CODE_TTL_SECONDS / 60,
          `${firstName} ${lastName}`,
        ),
      );
    } catch (err) {
      this.pendingRegistrations.delete(email);
      throw err;
    }

    return {
      message: 'Verification code sent',
      email,
      verificationExpiresInSeconds: CODE_TTL_SECONDS,
    };
  }

  async verifyEmail(rawEmail: string, code: string) {
    const email = String(rawEmail ?? '')
      .trim()
      .toLowerCase();
    const pending = this.pendingRegistrations.get(email);

    if (!pending) {
      throw new BadRequestException('Code is invalid or has expired');
    }

    if (pending.attempts >= MAX_ATTEMPTS) {
      this.pendingRegistrations.delete(email);
      throw new BadRequestException('Too many attempts, please register again');
    }

    const provided = Buffer.from(this.hashCode(email, String(code ?? '')));
    const expected = Buffer.from(pending.codeHash);
    const ok =
      provided.length === expected.length &&
      timingSafeEqual(provided, expected);

    if (!ok) {
      pending.attempts += 1;
      throw new BadRequestException('Code is invalid or has expired');
    }

    try {
      const user = await this.userModel.create({
        userId: randomUUID(),
        email,
        password: pending.passwordHash,
        firstName: pending.firstName,
        lastName: pending.lastName,
        role: Role.USER,
        isActive: true,
      });

      this.pendingRegistrations.delete(email);

      return {
        message: 'Email verified, account created',
        userId: user.userId,
        email: user.email,
      };
    } catch (err: any) {
      if (err?.code === 11000) {
        this.pendingRegistrations.delete(email);
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
  }
}
