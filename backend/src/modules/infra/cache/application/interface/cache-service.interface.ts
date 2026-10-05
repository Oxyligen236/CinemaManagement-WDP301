export const CACHE_SERVICE = Symbol('CACHE_SERVICE');

export interface CacheService {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  delByPattern(pattern: string): Promise<void>;
}
