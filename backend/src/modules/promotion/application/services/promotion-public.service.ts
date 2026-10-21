import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ValidatePromotionUsecase } from '../usecase/validate-promotion.usecase';
import { GetPublicPromotionUsecase } from '../usecase/get-public-promotion.usecase';
import {
  Promotion,
  PromotionDocument,
} from '../../domain/schemas/promotion.schema';
import { DiscountType } from '../../domain/enums/discount-type.enum';
import { PromotionResponseDto } from '../dto/res.dto';

@Injectable()
export class PromotionPublicService
  implements
    ValidatePromotionUsecase,
    GetPublicPromotionUsecase
{
  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
  ) {}

  async validatePromotionCode(params: {
    code: string;
    orderAmount: number;
    userId: string;
  }): Promise<{
    isValid: boolean;
    promotionId?: string;
    discountAmount: number;
    reason?: string;
  }> {
    const { code, orderAmount } = params;
    const normalizedCode = (code || '').trim().toUpperCase();

    if (!normalizedCode) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Promotion code cannot be empty',
      };
    }

    const promotion = await this.promotionModel
      .findOne({ promotionCode: normalizedCode })
      .exec();

    if (!promotion) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Promotion not found',
      };
    }

    if (!promotion.isActive) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Promotion is inactive',
      };
    }

    const now = new Date();
    if (now < promotion.startDate) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Promotion has not started yet',
      };
    }

    if (now > promotion.endDate) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Promotion has expired',
      };
    }

    const discountAmount =
      promotion.discountType === DiscountType.PERCENTAGE
        ? Math.round((orderAmount * promotion.discountValue) / 100)
        : Math.min(promotion.discountValue, orderAmount);

    return {
      isValid: true,
      promotionId: promotion.promotionId,
      discountAmount,
    };
  }

  async getPromotionById(
    promotionId: string,
  ): Promise<PromotionResponseDto | null> {
    const promo = await this.promotionModel.findOne({ promotionId }).exec();
    if (!promo) {
      return null;
    }

    return PromotionResponseDto.of(
      promo.promotionId,
      promo.promotionCode,
      promo.discountValue,
      promo.discountType,
      promo.startDate,
      promo.endDate,
      promo.isActive,
      promo.createdAt,
      promo.updatedAt,
    );
  }

}
