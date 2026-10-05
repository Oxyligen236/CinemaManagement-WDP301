import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullmqService } from './bullmq.service';
import { QUEUE_SERVICE } from '../application/queue-service.interface';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [
        ConfigModule,
        BullModule.registerQueue(
          { name: 'default' },
          {
            name: 'video-processing',
          },
        ),
      ],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue({ name: 'default' }),
  ],
  providers: [
    BullmqService,
    {
      provide: QUEUE_SERVICE,
      useExisting: BullmqService,
    },
  ],
  exports: [BullModule, BullmqService, QUEUE_SERVICE],
})
export class BullmqModule {}
