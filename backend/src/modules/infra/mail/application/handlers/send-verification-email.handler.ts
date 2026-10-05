import { Inject, Injectable, Logger } from '@nestjs/common';
import { Handler } from '../../../../../common/application/handler';
import { UserRegisteredEvent } from '../../../../auth/domain/events/user-registered.event';
import { MAIL_SERVICE } from '../interface/mail-service.interface';
import type { MailService } from '../interface/mail-service.interface';

@Injectable()
export class SendVerificationEmailHandler implements Handler<UserRegisteredEvent> {
  private readonly logger = new Logger(SendVerificationEmailHandler.name);

  constructor(
    @Inject(MAIL_SERVICE)
    private readonly mailService: MailService,
  ) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    const expiresInMinutes = Math.max(
      1,
      Math.round(event.expiresInSeconds / 60),
    );

    try {
      await this.mailService.sendMail({
        to: event.email,
        subject: 'Xác thực tài khoản - Mã OTP',
        template: 'verification',
        context: {
          name: event.displayName || event.email,
          code: event.code,
          expiresInMinutes,
        },
      });
      this.logger.log(`Verification email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${event.email}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
