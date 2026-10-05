/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CACHE_SERVICE } from '../application/interface/cache-service.interface';
import Redis from 'ioredis/built/Redis.js';
import { RedisService } from './redis.service';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [
    {
      provide: Redis,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis =>
        new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          lazyConnect: true,
        }),
    },
    RedisService,
    {
      provide: CACHE_SERVICE,
      useExisting: RedisService,
    },
  ],
  exports: [CACHE_SERVICE, RedisService, Redis],
})
export class RedisModule {}
