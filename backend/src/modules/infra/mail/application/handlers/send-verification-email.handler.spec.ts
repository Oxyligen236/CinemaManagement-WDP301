import { Logger } from '@nestjs/common';
import { UserRegisteredEvent } from '../../../../auth/domain/events/user-registered.event';
import { SendVerificationEmailHandler } from './send-verification-email.handler';

describe('SendVerificationEmailHandler', () => {
  let handler: SendVerificationEmailHandler;
  let mailService: { sendMail: jest.Mock };
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mailService = { sendMail: jest.fn() };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    handler = new SendVerificationEmailHandler(mailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends verification email using displayName and computed expiresInMinutes', async () => {
    mailService.sendMail.mockResolvedValue(undefined);
    const event = new UserRegisteredEvent(
      'user@cinema.local',
      '123456',
      300,
      'Minh Nguyen',
    );

    await handler.handle(event);

    expect(mailService.sendMail).toHaveBeenCalledWith({
      to: 'user@cinema.local',
      subject: 'Xác thực tài khoản - Mã OTP',
      template: 'verification',
      context: {
        name: 'Minh Nguyen',
        code: '123456',
        expiresInMinutes: 5,
      },
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Verification email sent to user@cinema.local',
    );
  });

  it('falls back to email when displayName is empty and clamps expiresInMinutes to at least 1', async () => {
    mailService.sendMail.mockResolvedValue(undefined);
    const event = new UserRegisteredEvent('user@cinema.local', '654321', 20);

    await handler.handle(event);

    expect(mailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          name: 'user@cinema.local',
          code: '654321',
          expiresInMinutes: 1,
        },
      }),
    );
  });

  it('logs error stack and rethrows when sendMail rejects with Error', async () => {
    const err = new Error('SMTP timeout');
    mailService.sendMail.mockRejectedValue(err);
    const event = new UserRegisteredEvent('user@cinema.local', '123456', 300);

    await expect(handler.handle(event)).rejects.toThrow('SMTP timeout');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send verification email to user@cinema.local',
      err.stack,
    );
  });

  it('logs raw error and rethrows when sendMail rejects with non-Error', async () => {
    mailService.sendMail.mockRejectedValue('smtp-string-error');
    const event = new UserRegisteredEvent('user@cinema.local', '123456', 300);

    await expect(handler.handle(event)).rejects.toBe('smtp-string-error');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send verification email to user@cinema.local',
      'smtp-string-error',
    );
  });
});
