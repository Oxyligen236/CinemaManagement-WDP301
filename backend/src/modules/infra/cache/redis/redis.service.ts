import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis/built/Redis.js';
import { CacheService } from '../application/interface/cache-service.interface';

@Injectable()
export class RedisService implements CacheService, OnModuleDestroy {
  constructor(private readonly redis: Redis) {}

  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return Number(await this.redis.ttl(key));
  }

  async keys(pattern: string): Promise<string[]> {
    const result = await this.redis.keys(pattern);
    return result;
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
