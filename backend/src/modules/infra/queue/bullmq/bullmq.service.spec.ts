import { ConfigService } from '@nestjs/config';
import { Handler } from '../../../../common/application/handler';

const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();
const mockWorkerClose = jest.fn();
const MockQueue = jest.fn().mockImplementation(() => ({
  add: mockQueueAdd,
  close: mockQueueClose,
}));
const MockWorker = jest.fn().mockImplementation(() => ({
  close: mockWorkerClose,
}));

jest.mock('bullmq', () => ({
  Queue: MockQueue,
  Worker: MockWorker,
}));

import { BullmqService } from './bullmq.service';

describe('BullmqService', () => {
  let service: BullmqService;
  let configGet: jest.Mock;

  const createConfigService = (password?: string): ConfigService => {
    configGet = jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'REDIS_HOST') return 'redis.internal';
      if (key === 'REDIS_PORT') return 6380;
      if (key === 'REDIS_PASSWORD') return password;
      return defaultValue;
    });
    return { get: configGet } as unknown as ConfigService;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue(undefined);
    mockQueueClose.mockResolvedValue(undefined);
    mockWorkerClose.mockResolvedValue(undefined);
    service = new BullmqService(createConfigService('secret-pass'));
  });

  describe('publish', () => {
    it('creates a Queue with REDIS_PASSWORD and publishes job with options', async () => {
      await service.publish(
        'email-queue',
        { email: 'a@b.com' },
        { attempts: 3, delayTime: 500 },
      );

      expect(MockQueue).toHaveBeenCalledTimes(1);
      expect(MockQueue).toHaveBeenCalledWith('email-queue', {
        connection: {
          host: 'redis.internal',
          port: 6380,
          password: 'secret-pass',
        },
      });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'default',
        { email: 'a@b.com' },
        { attempts: 3, delay: 500 },
      );
    });

    it('reuses cached Queue instance on subsequent publish to same queueName', async () => {
      await service.publish('jobs', { step: 1 });
      await service.publish('jobs', { step: 2 });

      expect(MockQueue).toHaveBeenCalledTimes(1);
      expect(mockQueueAdd).toHaveBeenCalledTimes(2);
      expect(mockQueueAdd).toHaveBeenLastCalledWith(
        'default',
        { step: 2 },
        { attempts: undefined, delay: undefined },
      );
    });

    it('sets password to undefined when REDIS_PASSWORD is empty or missing', async () => {
      const noPassService = new BullmqService(createConfigService(''));

      await noPassService.publish('no-pass-queue', { ok: true });

      expect(MockQueue).toHaveBeenCalledWith('no-pass-queue', {
        connection: {
          host: 'redis.internal',
          port: 6380,
          password: undefined,
        },
      });
    });
  });

  describe('consume', () => {
    it('registers a Worker and executes handler.handle inside worker processor', async () => {
      const handleMock = jest.fn().mockResolvedValue(undefined);
      const handler: Handler<{ orderId: string }> = {
        handle: handleMock,
      };

      await service.consume('orders', handler);

      expect(MockWorker).toHaveBeenCalledTimes(1);
      expect(MockWorker).toHaveBeenCalledWith('orders', expect.any(Function), {
        connection: {
          host: 'redis.internal',
          port: 6380,
          password: 'secret-pass',
        },
      });

      const workerCalls = MockWorker.mock.calls as Array<
        [string, (job: { data: { orderId: string } }) => Promise<void>, unknown]
      >;
      const processor = workerCalls[0][1];
      await processor({ data: { orderId: 'ord-1' } });

      expect(handleMock).toHaveBeenCalledWith({ orderId: 'ord-1' });
    });

    it('ignores duplicate consume calls for an already registered queueName', async () => {
      const handler: Handler<unknown> = {
        handle: jest.fn().mockResolvedValue(undefined),
      };

      await service.consume('orders', handler);
      await service.consume('orders', handler);

      expect(MockWorker).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('closes all workers and queues and clears internal registries', async () => {
      const handler: Handler<unknown> = {
        handle: jest.fn().mockResolvedValue(undefined),
      };

      await service.publish('q1', { a: 1 });
      await service.consume('w1', handler);
      await service.onModuleDestroy();

      expect(mockWorkerClose).toHaveBeenCalledTimes(1);
      expect(mockQueueClose).toHaveBeenCalledTimes(1);

      // Registries are cleared, so new publish/consume creates fresh instances
      await service.publish('q1', { a: 2 });
      await service.consume('w1', handler);
      expect(MockQueue).toHaveBeenCalledTimes(2);
      expect(MockWorker).toHaveBeenCalledTimes(2);
    });
  });
});
