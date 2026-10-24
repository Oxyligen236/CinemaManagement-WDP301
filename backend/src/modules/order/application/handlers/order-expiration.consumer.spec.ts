/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { OrderExpirationConsumer } from './order-expiration.consumer';
import {
  QUEUE_SERVICE,
  QueueService,
} from '../../../infra/queue/application/queue-service.interface';
import { ORDER_EXPIRATION_QUEUE } from '../../domain/constants/order.constant';
import { OrderService } from '../services/order.service';

describe('OrderExpirationConsumer', () => {
  let consumer: OrderExpirationConsumer;

  const mockQueueService: QueueService = {
    publish: jest.fn(),
    consume: jest.fn(),
  };

  const mockOrderService = {
    expireOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderExpirationConsumer,
        {
          provide: QUEUE_SERVICE,
          useValue: mockQueueService,
        },
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
      ],
    }).compile();

    consumer = module.get<OrderExpirationConsumer>(OrderExpirationConsumer);
  });

  it('dang ky consume order-expiration queue khi module khoi tao', async () => {
    await consumer.onModuleInit();

    expect(mockQueueService.consume).toHaveBeenCalledWith(
      ORDER_EXPIRATION_QUEUE,
      consumer,
    );
  });

  it('khi nhan job qua handle: goi orderService.expireOrder voi orderId', async () => {
    mockOrderService.expireOrder.mockResolvedValue(true);

    await consumer.handle({ orderId: 'order-123' });

    expect(mockOrderService.expireOrder).toHaveBeenCalledWith('order-123');
  });

  it('bo qua neu jobData khong co orderId', async () => {
    await consumer.handle({} as { orderId: string });

    expect(mockOrderService.expireOrder).not.toHaveBeenCalled();
  });
});
