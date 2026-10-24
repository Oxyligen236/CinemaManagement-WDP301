import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  QUEUE_SERVICE,
  QueueService,
} from '../../../infra/queue/application/queue-service.interface';
import { Handler } from '../../../../common/application/handler';
import { ORDER_EXPIRATION_QUEUE } from '../../domain/constants/order.constant';
import { OrderService } from '../services/order.service';

@Injectable()
export class OrderExpirationConsumer
  implements OnModuleInit, Handler<{ orderId: string }>
{
  private readonly logger = new Logger(OrderExpirationConsumer.name);

  constructor(
    @Inject(QUEUE_SERVICE)
    private readonly queueService: QueueService,
    private readonly orderService: OrderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.consume<{ orderId: string }>(
      ORDER_EXPIRATION_QUEUE,
      this,
    );
  }

  async handle(jobData: { orderId: string }): Promise<void> {
    if (!jobData?.orderId) {
      return;
    }
    try {
      await this.orderService.expireOrder(jobData.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to expire order ${jobData.orderId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
