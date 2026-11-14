import { Logger } from '@nestjs/common';
import { UserRegisteredEvent } from '../../../../auth/domain/events/user-registered.event';
import { UserCreatedEvent } from '../../../../user/domain/events/user-created.event';
import { SendVerificationEmailHandler } from '../../application/handlers/send-verification-email.handler';
import { SendWelcomeEmailHandler } from '../../application/handlers/send-welcome-email.handler';
import { MailListener } from './mail.listener';

describe('MailListener', () => {
  let listener: MailListener;
  let sendVerificationEmailHandler: { handle: jest.Mock };
  let sendWelcomeEmailHandler: { handle: jest.Mock };

  beforeEach(() => {
    sendVerificationEmailHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };
    sendWelcomeEmailHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    listener = new MailListener(
      sendVerificationEmailHandler as unknown as SendVerificationEmailHandler,
      sendWelcomeEmailHandler as unknown as SendWelcomeEmailHandler,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleUserRegisteredEvent', () => {
    it('forwards UserRegisteredEvent instance directly to handler', async () => {
      const event = new UserRegisteredEvent(
        'u@cinema.local',
        '123456',
        300,
        'User',
      );

      await listener.handleUserRegisteredEvent(event);

      expect(sendVerificationEmailHandler.handle).toHaveBeenCalledWith(event);
    });

    it('deserializes string payload before forwarding to handler', async () => {
      const serialized = new UserRegisteredEvent(
        'u@cinema.local',
        '654321',
        300,
        'User',
      ).serialize();

      await listener.handleUserRegisteredEvent(serialized);

      expect(sendVerificationEmailHandler.handle).toHaveBeenCalledWith(
        expect.any(UserRegisteredEvent),
      );
      expect(sendVerificationEmailHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'u@cinema.local',
          code: '654321',
          expiresInSeconds: 300,
          displayName: 'User',
        }),
      );
    });
  });

  describe('handleUserCreatedEvent', () => {
    it('forwards UserCreatedEvent instance directly to handler', async () => {
      const event = new UserCreatedEvent('u@cinema.local', 'User');

      await listener.handleUserCreatedEvent(event);

      expect(sendWelcomeEmailHandler.handle).toHaveBeenCalledWith(event);
    });

    it('deserializes string payload before forwarding to handler', async () => {
      const serialized = new UserCreatedEvent(
        'u@cinema.local',
        'User',
      ).serialize();

      await listener.handleUserCreatedEvent(serialized);

      expect(sendWelcomeEmailHandler.handle).toHaveBeenCalledWith(
        expect.any(UserCreatedEvent),
      );
      expect(sendWelcomeEmailHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'u@cinema.local',
          displayName: 'User',
        }),
      );
    });
  });
});
