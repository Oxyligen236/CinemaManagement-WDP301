import { Inject, Injectable, Logger } from '@nestjs/common';
import { Handler } from '../../../../../common/application/handler';
import { UserCreatedEvent } from '../../../../user/domain/events/user-created.event';
import { MAIL_SERVICE } from '../interface/mail-service.interface';
import type { MailService } from '../interface/mail-service.interface';

@Injectable()
export class SendWelcomeEmailHandler implements Handler<UserCreatedEvent> {
  private readonly logger = new Logger(SendWelcomeEmailHandler.name);

  constructor(
    @Inject(MAIL_SERVICE)
    private readonly mailService: MailService,
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    try {
      await this.mailService.sendMail({
        to: event.email,
        subject: 'Chào mừng gia nhập hệ thống!',
        template: 'welcome',
        context: {
          name: event.displayName || event.email,
          message: 'Chào mừng bạn tham gia hệ thống!',
        },
      });
      this.logger.log(`Welcome email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${event.email}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
