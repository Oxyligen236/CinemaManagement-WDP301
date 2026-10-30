import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const mongoUri = process.env.MONGODB_URI;
    super(
      mongoUri
        ? {
            datasources: {
              db: {
                url: mongoUri,
              },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to MongoDB via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from MongoDB');
  }
}
