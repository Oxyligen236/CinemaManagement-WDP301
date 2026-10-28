import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { ValidatePromotionUsecase } from '../usecase/validate-promotion.usecase';
import { GetPublicPromotionUsecase } from '../usecase/get-public-promotion.usecase';
import { RecordPromotionUsageUsecase } from '../usecase/record-promotion-usage.usecase';
import {
  Promotion,
  PromotionDocument,
} from '../../domain/schemas/promotion.schema';
import {
  PromotionUsage,
  PromotionUsageDocument,
} from '../../domain/schemas/promotion-usage.schema';
import { DiscountType } from '../../domain/enums/discount-type.enum';
import { PromotionResponseDto } from '../dto/res.dto';

@Injectable()
export class PromotionPublicService
  implements
    ValidatePromotionUsecase,
    GetPublicPromotionUsecase,
    RecordPromotionUsageUsecase
{
  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
    @InjectModel(PromotionUsage.name)
    private readonly promotionUsageModel: Model<PromotionUsageDocument>,
  ) {}

  async validatePromotionCode(params: {
    code: string;
    orderAmount: number;
    userId: string;
  }): Promise<{
    isValid: boolean;
    promotionId?: string;
    promotionCode?: string;
    discountType?: string;
    discountValue?: number;
    discountAmount: number;
    reason?: string;
  }> {
    const { code, orderAmount, userId } = params;
    const normalizedCode = (code || '').trim().toUpperCase();

    if (!normalizedCode) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Mã giảm giá không được để trống',
      };
    }

    const promotion = await this.promotionModel
      .findOne({ promotionCode: normalizedCode })
      .exec();

    if (!promotion) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Mã giảm giá không tồn tại',
      };
    }

    if (!promotion.isActive) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Mã giảm giá hiện đang tạm ngừng hoạt động',
      };
    }

    const now = new Date();
    if (now < promotion.startDate) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Mã giảm giá chưa đến ngày áp dụng',
      };
    }

    if (now > promotion.endDate) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Mã giảm giá đã hết hạn sử dụng',
      };
    }

    if (
      promotion.minOrderValue !== undefined &&
      promotion.minOrderValue > 0 &&
      orderAmount < promotion.minOrderValue
    ) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: `Giá trị đơn hàng chưa đạt mức tối thiểu ${promotion.minOrderValue}`,
      };
    }

    if (
      promotion.usageLimit !== undefined &&
      promotion.usageLimit > 0 &&
      (promotion.usedCount ?? 0) >= promotion.usageLimit
    ) {
      return {
        isValid: false,
        discountAmount: 0,
        reason: 'Mã giảm giá đã hết lượt sử dụng',
      };
    }

    if (userId) {
      const hasUsed = await this.promotionUsageModel.exists({
        promotionId: promotion.promotionId,
        userId,
      });

      if (hasUsed) {
        return {
          isValid: false,
          discountAmount: 0,
          reason: 'Bạn đã sử dụng mã giảm giá này rồi',
        };
      }
    }

    let discountAmount =
      promotion.discountType === DiscountType.PERCENTAGE
        ? Math.round((orderAmount * promotion.discountValue) / 100)
        : Math.min(promotion.discountValue, orderAmount);

    if (
      promotion.discountType === DiscountType.PERCENTAGE &&
      promotion.maxDiscountAmount !== undefined &&
      promotion.maxDiscountAmount > 0
    ) {
      discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
    }

    return {
      isValid: true,
      promotionId: promotion.promotionId,
      promotionCode: promotion.promotionCode,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      discountAmount,
    };
  }

  async recordPromotionUsage(params: {
    promotionId: string;
    userId: string;
    orderId: string;
  }): Promise<void> {
    const { promotionId, userId, orderId } = params;
    try {
      await this.promotionUsageModel.create({
        usageId: randomUUID(),
        promotionId,
        userId,
        orderId,
        usedAt: new Date(),
      });

      await this.promotionModel.updateOne(
        { promotionId },
        { $inc: { usedCount: 1 } },
      );
    } catch (err: unknown) {
      const mongoError = err as { code?: number };
      if (mongoError?.code === 11000) {
        // Idempotency: Người dùng đã được ghi nhận trước đó, bỏ qua để tránh lỗi crash luồng event
        return;
      }
      throw err;
    }
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
