import { Logger } from '@nestjs/common';
import { MailerService as NestMailer } from '@nestjs-modules/mailer';
import { NestMailerService } from './nest-mailer.service';

describe('NestMailerService', () => {
  let service: NestMailerService;
  let mockMailer: { sendMail: jest.Mock };
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockMailer = {
      sendMail: jest.fn(),
    };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    service = new NestMailerService(mockMailer as unknown as NestMailer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends mail and logs recipient when options.to is a string', async () => {
    mockMailer.sendMail.mockResolvedValue(undefined);

    await service.sendMail({
      to: 'user@cinema.local',
      subject: 'Hello',
      text: 'Test body',
    });

    expect(mockMailer.sendMail).toHaveBeenCalledWith({
      to: 'user@cinema.local',
      subject: 'Hello',
      text: 'Test body',
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Mail sent successfully to: user@cinema.local',
    );
  });

  it('stringifies non-string recipient in logs', async () => {
    mockMailer.sendMail.mockResolvedValue(undefined);

    await service.sendMail({
      to: ['a@cinema.local', 'b@cinema.local'],
      subject: 'Hello',
    });

    expect(logSpy).toHaveBeenCalledWith(
      'Mail sent successfully to: ["a@cinema.local","b@cinema.local"]',
    );
  });

  it('logs Error message and stack and rethrows when mailer fails with an Error', async () => {
    const err = new Error('SMTP connection refused');
    mockMailer.sendMail.mockRejectedValue(err);

    await expect(
      service.sendMail({ to: 'user@cinema.local', subject: 'Fail' }),
    ).rejects.toThrow('SMTP connection refused');

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send email to user@cinema.local: SMTP connection refused',
      err.stack,
    );
  });

  it('logs stringified error without stack and rethrows when mailer fails with a non-Error value', async () => {
    mockMailer.sendMail.mockRejectedValue('raw-smtp-failure');

    await expect(
      service.sendMail({
        to: { name: 'User', address: 'user@cinema.local' },
        subject: 'Fail',
      }),
    ).rejects.toBe('raw-smtp-failure');

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send email to {"name":"User","address":"user@cinema.local"}: raw-smtp-failure',
      undefined,
    );
  });
});
