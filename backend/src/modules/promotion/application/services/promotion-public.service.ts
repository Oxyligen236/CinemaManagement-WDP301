import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DiscountType } from '@prisma/client';
import { DiscountType as DomainDiscountType } from '../../domain/enums/discount-type.enum';
import {
  PromotionResponseDto,
  ValidatePromotionResultDto,
} from '../dto/res.dto';

@Injectable()
export class PromotionPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async validatePromotionCode(params: {
    code: string;
    orderAmount: number;
    userId: string;
  }): Promise<ValidatePromotionResultDto> {
    const { code, orderAmount, userId } = params;
    const normalizedCode = (code || '').trim().toUpperCase();

    if (!normalizedCode) {
      return ValidatePromotionResultDto.of(
        false,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        'Mã giảm giá không được để trống',
      );
    }

    const promotion = await this.prisma.promotion.findFirst({
      where: { promotionCode: normalizedCode },
    });

    if (!promotion) {
      return ValidatePromotionResultDto.of(
        false,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        'Mã giảm giá không tồn tại',
      );
    }

    if (!promotion.isActive) {
      return ValidatePromotionResultDto.of(
        false,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        'Mã giảm giá hiện đang tạm ngừng hoạt động',
      );
    }

    const now = new Date();
    if (now < promotion.startDate) {
      return ValidatePromotionResultDto.of(
        false,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        'Mã giảm giá chưa đến ngày áp dụng',
      );
    }

    if (now > promotion.endDate) {
      return ValidatePromotionResultDto.of(
        false,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        'Mã giảm giá đã hết hạn sử dụng',
      );
    }

    if (
      promotion.minOrderValue !== null &&
      promotion.minOrderValue !== undefined &&
      promotion.minOrderValue > 0 &&
      orderAmount < promotion.minOrderValue
    ) {
      return ValidatePromotionResultDto.of(
        false,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        `Giá trị đơn hàng chưa đạt mức tối thiểu ${promotion.minOrderValue}`,
      );
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usageLimit !== undefined &&
      promotion.usageLimit > 0 &&
      (promotion.usedCount ?? 0) >= promotion.usageLimit
    ) {
      return ValidatePromotionResultDto.of(
        false,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        'Mã giảm giá đã hết lượt sử dụng',
      );
    }

    if (userId) {
      const hasUsed = await this.prisma.promotionUsage.findFirst({
        where: {
          promotionId: promotion.id,
          userId,
        },
      });

      if (hasUsed) {
        return ValidatePromotionResultDto.of(
          false,
          0,
          undefined,
          undefined,
          undefined,
          undefined,
          'Bạn đã sử dụng mã giảm giá này rồi',
        );
      }
    }

    let discountAmount =
      promotion.discountType === DiscountType.PERCENTAGE
        ? Math.round((orderAmount * promotion.discountValue) / 100)
        : Math.min(promotion.discountValue, orderAmount);

    if (
      promotion.discountType === DiscountType.PERCENTAGE &&
      promotion.maxDiscountAmount !== null &&
      promotion.maxDiscountAmount !== undefined &&
      promotion.maxDiscountAmount > 0
    ) {
      discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
    }

    return ValidatePromotionResultDto.of(
      true,
      discountAmount,
      promotion.id,
      promotion.promotionCode,
      promotion.discountType,
      promotion.discountValue,
    );
  }

  async recordPromotionUsage(params: {
    promotionId: string;
    userId: string;
    orderId: string;
  }): Promise<void> {
    const { promotionId, userId, orderId } = params;
    try {
      await this.prisma.promotionUsage.create({
        data: {
          promotionId,
          userId,
          orderId,
          usedAt: new Date(),
        },
      });

      await this.prisma.promotion.update({
        where: { id: promotionId },
        data: { usedCount: { increment: 1 } },
      });
    } catch {
      // Idempotency: Người dùng đã được ghi nhận trước đó, bỏ qua để tránh lỗi crash luồng event
      return;
    }
  }

  async getPromotionById(
    promotionId: string,
  ): Promise<PromotionResponseDto | null> {
    const promo = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
    });
    if (!promo) {
      return null;
    }

    return PromotionResponseDto.of(
      promo.id,
      promo.promotionCode,
      promo.discountValue,
      promo.discountType as unknown as DomainDiscountType,
      promo.startDate,
      promo.endDate,
      promo.isActive,
      promo.createdAt,
      promo.updatedAt,
    );
  }
}
