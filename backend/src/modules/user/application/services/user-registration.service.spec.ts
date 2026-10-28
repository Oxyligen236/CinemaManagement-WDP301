import { ConflictException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRegistrationService } from './user-registration.service';
import { PendingRegistrationService } from './pending-registration.service';
import { User, UserDocument } from '../../domain/schemas/user.schema';
import { EventModule } from '../../../infra/event/event.module';
import { MailListener } from '../../../infra/mail/infrastructure/listeners/mail.listener';
import { SendVerificationEmailHandler } from '../../../infra/mail/application/handlers/send-verification-email.handler';
import { SendWelcomeEmailHandler } from '../../../infra/mail/application/handlers/send-welcome-email.handler';
import {
  MAIL_SERVICE,
  SendMailOptions,
} from '../../../infra/mail/application/interface/mail-service.interface';

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
  const userModel = {
    exists: jest.fn().mockResolvedValue(null),
    create: jest.fn((doc: Record<string, unknown>) => {
      created.push(doc);
      return Promise.resolve(doc);
    }),
  } as unknown as Model<UserDocument>;

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [EventModule],
    providers: [
      UserRegistrationService,
      PendingRegistrationService,
      MailListener,
      SendVerificationEmailHandler,
      SendWelcomeEmailHandler,
      { provide: MAIL_SERVICE, useValue: { sendMail } },
      { provide: getModelToken(User.name), useValue: userModel },
    ],
  }).compile();

  const app = await moduleRef.init();

  return {
    app,
    userModel,
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
      // Regression: the email used to render "1 phút" for a 5 minute code.
      expect(context.expiresInMinutes).toBe(5);
      expect(context.code).toMatch(/^\d{6}$/);
    });

    it('fails the request and clears the pending entry when SMTP is down', async () => {
      sendMail = createSendMailMock();
      sendMail.mockRejectedValue(new Error('SMTP down'));
      harness = await buildHarness(sendMail);

      // Regression: the mail error used to be swallowed, so register()
      // reported success and left a pending entry that blocked retries.
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

      // The resend cooldown must not punish the user for a server-side failure.
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

      // Regression: UserCreatedEvent was never published, so the welcome
      // email handler and template were dead code.
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
      ).rejects.toThrow('Code is invalid or has expired');

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
        ).rejects.toThrow('Code is invalid or has expired');
      }

      // Even the correct code must now be refused.
      await expect(
        harness.service.verifyEmail(REGISTER_INPUT.email, code),
      ).rejects.toThrow('Too many attempts, please register again');

      expect(harness.pending.get('new.user@cinema.local')).toBeUndefined();
    });

    it('maps a duplicate key error to a conflict', async () => {
      sendMail = createSendMailMock();
      harness = await buildHarness(sendMail);

      await harness.service.register(REGISTER_INPUT);
      const code = extractCode();

      (harness.userModel.create as unknown as jest.Mock).mockRejectedValue(
        Object.assign(new Error('duplicate'), { code: 11000 }),
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
      ).rejects.toThrow('Code is invalid or has expired');
    });
  });
});
