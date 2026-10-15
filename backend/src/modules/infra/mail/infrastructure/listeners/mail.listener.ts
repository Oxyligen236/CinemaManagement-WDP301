import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from '../../../../auth/domain/events/user-registered.event';
import { SendVerificationEmailHandler } from '../../application/handlers/send-verification-email.handler';

@Injectable()
export class MailListener {
  private readonly logger = new Logger(MailListener.name);

  constructor(
    private readonly sendVerificationEmailHandler: SendVerificationEmailHandler,
  ) {}

  @OnEvent(UserRegisteredEvent.EVENT_NAME, { async: true })
  async handleUserRegisteredEvent(
    event: UserRegisteredEvent | string,
  ): Promise<void> {
    const userRegisteredEvent =
      typeof event === 'string'
        ? UserRegisteredEvent.deserialize(event)
        : event;

    this.logger.log(
      `Sending verification email to ${userRegisteredEvent.email}`,
    );

    await this.sendVerificationEmailHandler.handle(userRegisteredEvent);
  }
}
