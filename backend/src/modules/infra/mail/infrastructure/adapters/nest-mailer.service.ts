import { Injectable, Logger } from '@nestjs/common';
import { MailerService as NestMailer } from '@nestjs-modules/mailer';
import {
  MailService,
  SendMailOptions,
} from '../../application/interface/mail-service.interface.js';

@Injectable()
export class NestMailerService implements MailService {
  private readonly logger = new Logger(NestMailerService.name);

  constructor(private readonly mailerService: NestMailer) {}

  async sendMail(options: SendMailOptions): Promise<void> {
    const to =
      typeof options.to === 'string' ? options.to : JSON.stringify(options.to);
    try {
      await this.mailerService.sendMail(options);
      this.logger.log(`Mail sent successfully to: ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
