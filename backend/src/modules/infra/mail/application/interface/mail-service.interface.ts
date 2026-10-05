import { ISendMailOptions } from '@nestjs-modules/mailer';

export const MAIL_SERVICE = Symbol('MAIL_SERVICE');

export type SendMailOptions = ISendMailOptions;

export interface MailService {
  sendMail(options: SendMailOptions): Promise<void>;
}
