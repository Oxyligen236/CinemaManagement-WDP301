/*
https://docs.nestjs.com/providers#services
*/

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  QueueJobOptions,
  QueueService,
} from '../application/queue-service.interface.js';
import { Handler } from '../../../../common/application/handler.js';
import { Queue as BullQueue, Worker as BullWorker } from 'bullmq';
import type { Queue, Worker } from 'bullmq/dist/esm/index.js';
import { ConfigService } from '@nestjs/config';

const QueueConstructor = BullQueue;
const WorkerConstructor = BullWorker;

@Injectable()
export class BullmqService implements QueueService, OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();

  constructor(private config: ConfigService) {}

  private getRedisOpts() {
    return {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
    };
  }

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new QueueConstructor(name, { connection: this.getRedisOpts() });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async publish<T>(
    queueName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.add('default', data, {
      attempts: options?.attempts,
    });
  }

  consume<T>(queueName: string, handler: Handler<T>): Promise<void> {
    if (this.workers.has(queueName)) return Promise.resolve();

    const worker = new WorkerConstructor<T>(
      queueName,
      async (job) => {
        await handler.handle(job.data);
      },
      { connection: this.getRedisOpts() },
    );

    this.workers.set(queueName, worker);
    return Promise.resolve();
  }

  async onModuleDestroy(): Promise<void> {
    const closeWorkers: Promise<void>[] = Array.from(
      this.workers.values(),
      (w) => w.close(),
    );
    const closeQueues: Promise<void>[] = Array.from(this.queues.values(), (q) =>
      q.close(),
    );
    await Promise.all([...closeWorkers, ...closeQueues]);
    this.workers.clear();
    this.queues.clear();
  }
}
