import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailListener {
  private readonly logger = new Logger(MailListener.name);

  constructor() {}
}
