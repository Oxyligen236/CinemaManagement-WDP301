import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PromotionPublicService } from '../../application/services/promotion-public.service';

@Injectable()
export class PromotionListener {
  private readonly logger = new Logger(PromotionListener.name);

  constructor(
    private readonly promotionPublicService: PromotionPublicService,
  ) {}

  @OnEvent('order.paid', { async: true })
  async handleOrderPaid(
    event:
      | {
          orderId: string;
          promotionId?: string;
          userId?: string;
          actorId?: string;
        }
      | string,
  ): Promise<void> {
    try {
      const payload =
        typeof event === 'string'
          ? (JSON.parse(event) as {
              orderId: string;
              promotionId?: string;
              userId?: string;
              actorId?: string;
            })
          : event;

      const promotionId = payload.promotionId;
      const userId =
        payload.userId || (payload as { actorId?: string }).actorId;

      if (!promotionId || !userId) {
        return;
      }

      await this.promotionPublicService.recordPromotionUsage({
        promotionId,
        userId,
        orderId: payload.orderId,
      });

      this.logger.log(
        `Đã ghi nhận sử dụng mã ${promotionId} cho user ${userId} tại đơn hàng ${payload.orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi ghi nhận sử dụng mã khuyến mãi cho event order.paid: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
    }
  }
}
