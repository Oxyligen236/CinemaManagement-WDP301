import type Redis from 'ioredis/built/Redis.js';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: jest.Mocked<
    Pick<Redis, 'get' | 'set' | 'del' | 'exists' | 'ttl' | 'keys' | 'quit'>
  >;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      quit: jest.fn(),
    };
    service = new RedisService(mockRedis as unknown as Redis);
  });

  describe('get', () => {
    it('returns null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.get('missing')).resolves.toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('missing');
    });

    it('parses and returns JSON value when stored value is valid JSON', async () => {
      mockRedis.get.mockResolvedValue('{"id":1,"name":"Cinema"}');

      await expect(
        service.get<{ id: number; name: string }>('obj'),
      ).resolves.toEqual({ id: 1, name: 'Cinema' });
    });

    it('returns raw string when stored value is not valid JSON', async () => {
      mockRedis.get.mockResolvedValue('plain-string-value');

      await expect(service.get('raw')).resolves.toBe('plain-string-value');
    });
  });

  describe('set', () => {
    it('stores string value with TTL using EX option', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('session:1', 'token-abc', 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'session:1',
        'token-abc',
        'EX',
        300,
      );
    });

    it('stores string value without TTL when ttlSeconds is omitted', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('session:2', 'token-xyz');

      expect(mockRedis.set).toHaveBeenCalledWith('session:2', 'token-xyz');
    });

    it('serializes object value with TTL using EX option', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('user:1', { role: 'ADMIN' }, 120);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'user:1',
        '{"role":"ADMIN"}',
        'EX',
        120,
      );
    });

    it('serializes object value without TTL when ttlSeconds is omitted', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('user:2', { active: true });

      expect(mockRedis.set).toHaveBeenCalledWith('user:2', '{"active":true}');
    });
  });

  describe('del', () => {
    it('deletes the given key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('key:1');

      expect(mockRedis.del).toHaveBeenCalledWith('key:1');
    });
  });

  describe('exists', () => {
    it('returns true when redis.exists returns 1', async () => {
      mockRedis.exists.mockResolvedValue(1);

      await expect(service.exists('key:1')).resolves.toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('key:1');
    });

    it('returns false when redis.exists returns 0', async () => {
      mockRedis.exists.mockResolvedValue(0);

      await expect(service.exists('key:missing')).resolves.toBe(false);
    });
  });

  describe('ttl', () => {
    it('returns numeric ttl for key', async () => {
      mockRedis.ttl.mockResolvedValue(42);

      await expect(service.ttl('key:1')).resolves.toBe(42);
      expect(mockRedis.ttl).toHaveBeenCalledWith('key:1');
    });
  });

  describe('keys', () => {
    it('returns matching keys for pattern', async () => {
      mockRedis.keys.mockResolvedValue(['user:1', 'user:2']);

      await expect(service.keys('user:*')).resolves.toEqual([
        'user:1',
        'user:2',
      ]);
      expect(mockRedis.keys).toHaveBeenCalledWith('user:*');
    });
  });

  describe('delByPattern', () => {
    it('does not call del when no keys match pattern', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.delByPattern('empty:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('empty:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('deletes all matched keys when keys are found', async () => {
      mockRedis.keys.mockResolvedValue(['cache:a', 'cache:b']);
      mockRedis.del.mockResolvedValue(2);

      await service.delByPattern('cache:*');

      expect(mockRedis.del).toHaveBeenCalledWith('cache:a', 'cache:b');
    });
  });

  describe('onModuleDestroy', () => {
    it('quits redis connection on module destroy', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });
  });
});
