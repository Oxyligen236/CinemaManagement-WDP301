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
      throw new BadRequestException(MSG.INVALID_DATA);
    }

    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    if (!email || !input.password.trim() || !firstName || !lastName) {
      throw new BadRequestException(MSG.ALL_FIELDS_REQUIRED);
    }

    if (await this.userModel.exists({ email })) {
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

  /**
   * Sinh mã mới, lưu pending registration và gửi email xác thực.
   *
   * Mã cũ bị thay thế ngay khi mã mới được sinh, nên chỉ mã gần nhất còn
   * hiệu lực. Nếu gửi email thất bại thì pending entry được rollback để người
   * dùng thử lại được ngay thay vì bị cooldown chặn.
   *
   * @param pending - Dữ liệu đăng ký chờ xác thực.
   * @param restorePrevious - `true` khi đang ghi đè một entry đã tồn tại:
   *   lúc rollback phải phục hồi entry cũ thay vì xoá trắng.
   */
  private async issueCode(
    pending: PendingUser,
    restorePrevious: boolean,
  ): Promise<void> {
    const { email, firstName, lastName } = pending;
    const previous = restorePrevious
      ? this.pendingRegistrations.get(email)
      : undefined;
    const code = String(randomInt(100000, 1000000));
    const now = Date.now();

    this.pendingRegistrations.save(email, {
      ...pending,
      codeHash: this.hashCode(email, code),
      expiresAt: now + CODE_TTL_SECONDS * 1000,
      lastSentAt: now,
    });

    try {
      await this.eventBus.publish(
        new UserRegisteredEvent(
          email,
          code,
          CODE_TTL_SECONDS,
          `${firstName} ${lastName}`,
        ),
      );
    } catch (err) {
      if (previous) {
        this.pendingRegistrations.save(email, previous);
      } else {
        this.pendingRegistrations.delete(email);
      }
      throw err;
    }
  }

  /**
   * Gửi lại mã xác thực cho một đăng ký đang chờ.
   *
   * Quy trình nghiệp vụ:
   * 1. Chặn nếu email đã có tài khoản (tránh dò email đã đăng ký).
   * 2. Yêu cầu phải tồn tại pending registration còn hiệu lực.
   * 3. Áp cooldown và giới hạn tổng số lần gửi lại.
   * 4. Sinh mã mới, reset số lần nhập sai và gửi email.
   *
   * @param rawEmail - Email đã đăng ký ở bước `register`.
   * @returns Thông báo cùng thời hạn hiệu lực của mã mới.
   * @throws ConflictException khi email đã có tài khoản.
   * @throws BadRequestException khi không còn đăng ký chờ xác thực.
   * @throws HttpException 429 khi còn cooldown hoặc đã hết lượt gửi lại.
   */
  async resendVerificationCode(rawEmail: string) {
    const email = String(rawEmail ?? '')
      .trim()
      .toLowerCase();

    if (!email) {
      throw new BadRequestException(MSG.EMAIL_REQUIRED);
    }

    if (await this.userModel.exists({ email })) {
      throw new ConflictException(MSG.EMAIL_ALREADY_REGISTERED);
    }

    const pending = this.pendingRegistrations.get(email);

    if (!pending) {
      throw new BadRequestException(MSG.NO_PENDING_REGISTRATION);
    }

    if (Date.now() - pending.lastSentAt < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        MSG.RESEND_COOLDOWN,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (pending.resendCount >= MAX_RESENDS) {
      throw new HttpException(
        MSG.RESEND_LIMIT_REACHED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Reset `attempts` để lần nhập sai trước không chặn mã mới, nhưng
    // `MAX_RESENDS` vẫn giới hạn tổng số mã được phát cho một đăng ký.
    await this.issueCode(
      { ...pending, attempts: 0, resendCount: pending.resendCount + 1 },
      true,
    );

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

    let user: UserDocument;

    try {
      user = await this.userModel.create({
        email,
        password: pending.passwordHash,
        firstName: pending.firstName,
        lastName: pending.lastName,
        role: Role.USER,
        isActive: true,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        this.pendingRegistrations.delete(email);
        throw new ConflictException(MSG.EMAIL_ALREADY_REGISTERED);
      }
      throw err;
    }

    this.pendingRegistrations.delete(email);

    // Email chào mừng chỉ mang tính thông báo: tài khoản đã được tạo thành
    // công nên lỗi gửi mail chỉ được ghi log, không làm thất bại xác thực.
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
      userId: (user._id ?? (user as any).userId)?.toString(),
      email: user.email,
    };
  }
}
