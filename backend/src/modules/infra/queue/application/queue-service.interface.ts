import { Handler } from '../../../../common/application/handler';

export const QUEUE_SERVICE = Symbol('QUEUE_SERVICE');

export interface QueueJobOptions {
  depley?: boolean;
  attempts?: number;
}

export interface QueueService {
  publish<T>(
    queueName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<void>;

  consume<T>(queueName: string, handler: Handler<T>): Promise<void>;
}
