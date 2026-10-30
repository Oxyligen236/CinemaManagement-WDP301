import { ConflictException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRegistrationService } from './user-registration.service';
import { PendingRegistrationService } from './pending-registration.service';
import { REGISTRATION_MESSAGES } from '../../domain/constants/auth-message.constants';
import { EventModule } from '../../../infra/event/event.module';
import { MailListener } from '../../../infra/mail/infrastructure/listeners/mail.listener';
import { SendVerificationEmailHandler } from '../../../infra/mail/application/handlers/send-verification-email.handler';
import { SendWelcomeEmailHandler } from '../../../infra/mail/application/handlers/send-welcome-email.handler';
import {
  MAIL_SERVICE,
  SendMailOptions,
} from '../../../infra/mail/application/interface/mail-service.interface';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const REGISTER_INPUT = {
  email: 'New.User@Cinema.local',
  password: 'Password123!',
  firstName: 'Minh',
  lastName: 'Nguyen',
};

type SendMailMock = jest.MockedFunction<
  (options: SendMailOptions) => Promise<void>
>;

const createSendMailMock = (): SendMailMock =>
  jest.fn<Promise<void>, [SendMailOptions]>().mockResolvedValue(undefined);

/**
 * Wire the real event bus, listener and handlers so the test exercises the
 * actual `@OnEvent` registration instead of a stubbed bus.
 */
const buildHarness = async (sendMail: SendMailMock) => {
  const created: Record<string, unknown>[] = [];
  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve({
          id: 'u-created',
          ...args.data,
        });
      }),
    },
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [EventModule],
    providers: [
      UserRegistrationService,
      PendingRegistrationService,
      MailListener,
      SendVerificationEmailHandler,
      SendWelcomeEmailHandler,
      { provide: MAIL_SERVICE, useValue: { sendMail } },
      { provide: PrismaService, useValue: mockPrisma },
    ],
  }).compile();

  const app = await moduleRef.init();

  return {
    app,
    mockPrisma,
    created,
    service: moduleRef.get(UserRegistrationService),
    pending: moduleRef.get(PendingRegistrationService),
  };
};

describe('UserRegistrationService (email verification flow)', () => {
  let harness: Awaited<ReturnType<typeof buildHarness>>;
  let sendMail: SendMailMock;

  afterEach(async () => {
    await harness?.app.close();
  });

  describe('register', () => {
    it('sends the OTP email stating the real 5 minute lifetime', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      const result = await harness.service.register(REGISTER_INPUT);

      expect(result.verificationExpiresInSeconds).toBe(300);
      expect(sendMail).toHaveBeenCalledTimes(1);

      const options = sendMail.mock.calls[0][0];
      const context = options.context as {
        code: string;
        expiresInMinutes: number;
      };

      expect(options.template).toBe('verification');
      expect(options.to).toBe('new.user@cinema.local');
      expect(context.expiresInMinutes).toBe(5);
      expect(context.code).toMatch(/^\d{6}$/);
    });

    it('fails the request and clears the pending entry when SMTP is down', async () => {
      sendMail = createSendMailMock();
      sendMail.mockRejectedValue(new Error('SMTP down'));
      harness = await buildHarness(sendMail);

      await expect(harness.service.register(REGISTER_INPUT)).rejects.toThrow(
        'SMTP down',
      );

      expect(harness.pending.get('new.user@cinema.local')).toBeUndefined();
    });

    it('allows an immediate retry after a send failure', async () => {
      sendMail = createSendMailMock();
      sendMail.mockRejectedValueOnce(new Error('SMTP down'));
      harness = await buildHarness(sendMail);

      await expect(harness.service.register(REGISTER_INPUT)).rejects.toThrow(
        'SMTP down',
      );

      await expect(
        harness.service.register(REGISTER_INPUT),
      ).resolves.toMatchObject({ email: 'new.user@cinema.local' });
    });

    it('rejects a genuine resend within the cooldown window', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);

      await expect(harness.service.register(REGISTER_INPUT)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('resendVerificationCode', () => {
    const skipCooldown = (harness: {
      pending: PendingRegistrationService;
    }): void => {
      const pending = harness.pending.get('new.user@cinema.local');
      if (!pending) throw new Error('expected a pending registration');
      pending.lastSentAt -= 61 * 1000;
    };

    const codeOfCall = (index: number): string => {
      const context = sendMail.mock.calls[index][0].context as {
        code: string;
      };
      return context.code;
    };

    it('issues a different code and invalidates the previous one', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      const firstCode = codeOfCall(0);
      skipCooldown(harness);

      const result = await harness.service.resendVerificationCode(
        REGISTER_INPUT.email,
      );

      expect(result.verificationExpiresInSeconds).toBe(300);
      expect(sendMail).toHaveBeenCalledTimes(2);
      expect(sendMail.mock.calls[1][0].template).toBe('verification');

      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, firstCode),
      ).rejects.toThrow(REGISTRATION_MESSAGES.CODE_INVALID_OR_EXPIRED);

      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, codeOfCall(1)),
      ).resolves.toMatchObject({ email: 'new.user@cinema.local' });
    });

    it('clears earlier wrong attempts so the new code is usable', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);

      for (let i = 0; i < 4; i += 1) {
        await expect(
          harness.service.verifyEmail(REGISTER_INPUT.email, '000000'),
        ).rejects.toThrow(REGISTRATION_MESSAGES.CODE_INVALID_OR_EXPIRED);
      }

      skipCooldown(harness);
      await harness.service.resendVerificationCode(REGISTER_INPUT.email);

      expect(harness.pending.get('new.user@cinema.local')?.attempts).toBe(0);
      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, codeOfCall(1)),
      ).resolves.toMatchObject({ email: 'new.user@cinema.local' });
    });

    it('enforces the cooldown between resends', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);

      await expect(
        harness.service.resendVerificationCode(REGISTER_INPUT.email),
      ).rejects.toThrow(REGISTRATION_MESSAGES.RESEND_COOLDOWN);

      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('caps the number of resends for one registration', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);

      for (let i = 0; i < 3; i += 1) {
        skipCooldown(harness);
        await harness.service.resendVerificationCode(REGISTER_INPUT.email);
      }

      skipCooldown(harness);
      await expect(
        harness.service.resendVerificationCode(REGISTER_INPUT.email),
      ).rejects.toThrow(REGISTRATION_MESSAGES.RESEND_LIMIT_REACHED);

      expect(sendMail).toHaveBeenCalledTimes(4);
    });

    it('keeps the old code valid when the resend email fails', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      const firstCode = codeOfCall(0);
      skipCooldown(harness);

      sendMail.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(
        harness.service.resendVerificationCode(REGISTER_INPUT.email),
      ).rejects.toThrow('SMTP down');

      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, firstCode),
      ).resolves.toMatchObject({ email: 'new.user@cinema.local' });
    });

    it('rejects a resend when no registration is pending', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await expect(
        harness.service.resendVerificationCode('nobody@cinema.local'),
      ).rejects.toThrow(REGISTRATION_MESSAGES.NO_PENDING_REGISTRATION);

      expect(sendMail).not.toHaveBeenCalled();
    });

    it('rejects a resend for an email that already has an account', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      skipCooldown(harness);
      harness.mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        harness.service.resendVerificationCode(REGISTER_INPUT.email),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyEmail', () => {
    const extractCode = () => {
      const context = sendMail.mock.calls[0][0].context as { code: string };
      return context.code;
    };

    it('creates the account and sends the welcome email', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      const code = extractCode();

      const result = await harness.service.verifyEmail(
        REGISTER_INPUT.email,
        code,
      );

      expect(result.email).toBe('new.user@cinema.local');
      expect(harness.created).toHaveLength(1);

      expect(sendMail).toHaveBeenCalledTimes(2);

      const welcome = sendMail.mock.calls[1][0];
      const context = welcome.context as { name: string };

      expect(welcome.template).toBe('welcome');
      expect(welcome.to).toBe('new.user@cinema.local');
      expect(context.name).toBe('Minh Nguyen');
    });

    it('still verifies the account when the welcome email fails', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      const code = extractCode();

      sendMail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, code),
      ).resolves.toMatchObject({ email: 'new.user@cinema.local' });

      expect(harness.created).toHaveLength(1);
      expect(harness.pending.get('new.user@cinema.local')).toBeUndefined();
    });

    it('rejects a wrong code and consumes an attempt', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);

      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, '000000'),
      ).rejects.toThrow(REGISTRATION_MESSAGES.CODE_INVALID_OR_EXPIRED);

      expect(harness.pending.get('new.user@cinema.local')?.attempts).toBe(1);
      expect(harness.created).toHaveLength(0);
    });

    it('locks the pending registration after 5 wrong attempts', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      const code = extractCode();

      for (let i = 0; i < 5; i += 1) {
        await expect(
          harness.service.verifyEmail(REGISTER_INPUT.email, '000000'),
        ).rejects.toThrow(REGISTRATION_MESSAGES.CODE_INVALID_OR_EXPIRED);
      }

      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, code),
      ).rejects.toThrow(REGISTRATION_MESSAGES.TOO_MANY_ATTEMPTS);

      expect(harness.pending.get('new.user@cinema.local')).toBeUndefined();
    });

    it('maps a duplicate key error to a conflict', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      const code = extractCode();

      harness.mockPrisma.user.create.mockRejectedValue(
        Object.assign(new Error('duplicate'), { code: 'P2002' }),
      );

      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, code),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects verification for an unknown email', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await expect(
        harness.service.verifyEmail('nobody@cinema.local', '123456'),
      ).rejects.toThrow(REGISTRATION_MESSAGES.CODE_INVALID_OR_EXPIRED);
    });
  });
});
