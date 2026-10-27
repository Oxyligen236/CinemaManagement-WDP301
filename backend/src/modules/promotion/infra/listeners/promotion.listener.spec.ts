import { PromotionListener } from './promotion.listener';
import { PromotionPublicService } from '../../application/services/promotion-public.service';

describe('PromotionListener', () => {
  let listener: PromotionListener;
  let mockPromotionPublicService: {
    recordPromotionUsage: jest.Mock;
  };

  beforeEach(() => {
    mockPromotionPublicService = {
      recordPromotionUsage: jest.fn(),
    };
    listener = new PromotionListener(
      mockPromotionPublicService as unknown as PromotionPublicService,
    );
  });

  it('xử lý event order.paid dạng object', async () => {
    await listener.handleOrderPaid({
      orderId: 'order-1',
      promotionId: 'promo-1',
      userId: 'user-1',
    });

    expect(
      mockPromotionPublicService.recordPromotionUsage,
    ).toHaveBeenCalledWith({
      promotionId: 'promo-1',
      userId: 'user-1',
      orderId: 'order-1',
    });
  });

  it('xử lý event order.paid dùng actorId làm fallback cho userId', async () => {
    await listener.handleOrderPaid({
      orderId: 'order-1',
      promotionId: 'promo-1',
      actorId: 'actor-1',
    });

    expect(
      mockPromotionPublicService.recordPromotionUsage,
    ).toHaveBeenCalledWith({
      promotionId: 'promo-1',
      userId: 'actor-1',
      orderId: 'order-1',
    });
  });

  it('xử lý event order.paid dạng JSON string', async () => {
    const eventString = JSON.stringify({
      orderId: 'order-1',
      promotionId: 'promo-1',
      userId: 'user-1',
    });

    await listener.handleOrderPaid(eventString);

    expect(
      mockPromotionPublicService.recordPromotionUsage,
    ).toHaveBeenCalledWith({
      promotionId: 'promo-1',
      userId: 'user-1',
      orderId: 'order-1',
    });
  });

  it('bỏ qua khi không có promotionId hoặc userId', async () => {
    await listener.handleOrderPaid({
      orderId: 'order-1',
    });

    expect(
      mockPromotionPublicService.recordPromotionUsage,
    ).not.toHaveBeenCalled();
  });
});
