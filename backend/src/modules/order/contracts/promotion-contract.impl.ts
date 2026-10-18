import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Promotion, PromotionDocument } from '../../promotion/domain/schemas/promotion.schema';
import { PromotionContract, PromotionDetailDto } from './promotion.contract';

@Injectable()
export class PromotionContractImpl implements PromotionContract {
  constructor(@InjectModel(Promotion.name) private readonly promotionModel: Model<PromotionDocument>) {}

  async getPromotionById(promotionId: string): Promise<PromotionDetailDto | null> {
    const promotion = await this.promotionModel.findOne({ promotionId }).exec();
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
}
