import { Injectable } from '@nestjs/common';
import { PromotionPublicService } from '../application/services/promotion-public.service';
import {
  PromotionContract,
  PromotionDetailDto,
  ValidatePromotionResultDto,
} from './promotion.contract';

@Injectable()
export class PromotionContractImpl implements PromotionContract {
  constructor(
    private readonly promotionPublicService: PromotionPublicService,
  ) {}

  async getPromotionById(
    promotionId: string,
  ): Promise<PromotionDetailDto | null> {
    const promotion =
      await this.promotionPublicService.getPromotionById(promotionId);
    if (!promotion) return null;
    return {
      promotionId: promotion.promotionId,
      promotionCode: promotion.promotionCode,
      discountValue: promotion.discountValue,
      discountType: promotion.discountType,
      isActive: promotion.isActive,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      createdAt: promotion.createdAt,
      updatedAt: promotion.updatedAt,
    };
  }

  async validatePromotionCode(params: {
    code: string;
    orderAmount: number;
    userId: string;
  }): Promise<ValidatePromotionResultDto> {
    return this.promotionPublicService.validatePromotionCode(params);
  }

  async recordPromotionUsage(params: {
    promotionId: string;
    userId: string;
    orderId: string;
  }): Promise<void> {
    return this.promotionPublicService.recordPromotionUsage(params);
  }
}
