import { Logger } from '@nestjs/common';
import { UserCreatedEvent } from '../../../../user/domain/events/user-created.event';
import { SendWelcomeEmailHandler } from './send-welcome-email.handler';

describe('SendWelcomeEmailHandler', () => {
  let handler: SendWelcomeEmailHandler;
  let mailService: { sendMail: jest.Mock };
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mailService = { sendMail: jest.fn() };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    handler = new SendWelcomeEmailHandler(mailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends welcome email using displayName when provided', async () => {
    mailService.sendMail.mockResolvedValue(undefined);
    const event = new UserCreatedEvent('user@cinema.local', 'Minh Nguyen');

    await handler.handle(event);

    expect(mailService.sendMail).toHaveBeenCalledWith({
      to: 'user@cinema.local',
      subject: 'Chào mừng gia nhập hệ thống!',
      template: 'welcome',
      context: {
        name: 'Minh Nguyen',
        message: 'Chào mừng bạn tham gia hệ thống!',
      },
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Welcome email sent to user@cinema.local',
    );
  });

  it('falls back to email when displayName is missing', async () => {
    mailService.sendMail.mockResolvedValue(undefined);
    const event = new UserCreatedEvent('user@cinema.local');

    await handler.handle(event);

    expect(mailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          name: 'user@cinema.local',
          message: 'Chào mừng bạn tham gia hệ thống!',
        },
      }),
    );
  });

  it('logs error stack and rethrows when sendMail rejects with Error', async () => {
    const err = new Error('SMTP down');
    mailService.sendMail.mockRejectedValue(err);
    const event = new UserCreatedEvent('user@cinema.local', 'Minh');

    await expect(handler.handle(event)).rejects.toThrow('SMTP down');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send welcome email to user@cinema.local',
      err.stack,
    );
  });

  it('logs raw error and rethrows when sendMail rejects with non-Error', async () => {
    mailService.sendMail.mockRejectedValue('smtp-string-error');
    const event = new UserCreatedEvent('user@cinema.local');

    await expect(handler.handle(event)).rejects.toBe('smtp-string-error');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send welcome email to user@cinema.local',
      'smtp-string-error',
    );
  });
});
