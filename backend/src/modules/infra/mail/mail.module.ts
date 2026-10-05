import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { MAIL_SERVICE } from './application/interface/mail-service.interface';
import { SendVerificationEmailHandler } from './application/handlers/send-verification-email.handler';
import { SendWelcomeEmailHandler } from './application/handlers/send-welcome-email.handler';
import { MailListener } from './infrastructure/listeners/mail.listener';
import { NestMailerService } from './infrastructure/adapters/nest-mailer.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const user = config.get<string>('MAIL_USER');
        const pass = config.get<string>('MAIL_PASSWORD');

        return {
          transport: {
            host: config.get<string>('MAIL_HOST', 'localhost'),
            port: Number(config.get<number>('MAIL_PORT', 587)),
            secure: config.get<string>('MAIL_SECURE') === 'true',
            auth: user && pass ? { user, pass } : undefined,
          },
          defaults: {
            from: config.get<string>(
              'MAIL_FROM',
              '"No Reply" <noreply@example.com>',
            ),
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [
    NestMailerService,
    SendVerificationEmailHandler,
    SendWelcomeEmailHandler,
    MailListener,
    {
      provide: MAIL_SERVICE,
      useExisting: NestMailerService,
    },
  ],
  exports: [MAIL_SERVICE, NestMailerService, MailerModule],
})
export class MailModule {}
