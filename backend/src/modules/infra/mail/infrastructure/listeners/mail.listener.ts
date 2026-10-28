import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from '../../../../auth/domain/events/user-registered.event';
import { UserCreatedEvent } from '../../../../user/domain/events/user-created.event';
import { SendVerificationEmailHandler } from '../../application/handlers/send-verification-email.handler';
import { SendWelcomeEmailHandler } from '../../application/handlers/send-welcome-email.handler';

@Injectable()
export class MailListener {
  private readonly logger = new Logger(MailListener.name);

  constructor(
    private readonly sendVerificationEmailHandler: SendVerificationEmailHandler,
    private readonly sendWelcomeEmailHandler: SendWelcomeEmailHandler,
  ) {}

  // `suppressErrors: false` để lỗi gửi mail được đẩy về `register()`, cho phép
  // xoá pending registration và báo lỗi thật cho người dùng.
  // Không dùng `{ async: true }` vì option này khiến `emitAsync` không chờ
  // listener, làm lỗi SMTP bị bỏ qua.
  @OnEvent(UserRegisteredEvent.EVENT_NAME, { suppressErrors: false })
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

  // Giữ `suppressErrors` mặc định (true): tài khoản đã được tạo xong nên lỗi
  // gửi email chào mừng chỉ cần ghi log, không được làm hỏng việc xác thực.
  @OnEvent(UserCreatedEvent.EVENT_NAME)
  async handleUserCreatedEvent(
    event: UserCreatedEvent | string,
  ): Promise<void> {
    const userCreatedEvent =
      typeof event === 'string' ? UserCreatedEvent.deserialize(event) : event;

    this.logger.log(`Sending welcome email to ${userCreatedEvent.email}`);

    await this.sendWelcomeEmailHandler.handle(userCreatedEvent);
  }
}
