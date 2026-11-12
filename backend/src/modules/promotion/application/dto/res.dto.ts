import { DiscountType } from '../../domain/enums/discount-type.enum';

export class PromotionResponseDto {
  promotionId!: string;
  promotionCode!: string;
  discountValue!: number;
  discountType!: DiscountType;
  startDate!: Date;
  endDate!: Date;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static of(
    promotionId: string,
    promotionCode: string,
    discountValue: number,
    discountType: DiscountType,
    startDate: Date,
    endDate: Date,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): PromotionResponseDto {
    const res = new PromotionResponseDto();
    res.promotionId = promotionId;
    res.promotionCode = promotionCode;
    res.discountValue = discountValue;
    res.discountType = discountType;
    res.startDate = startDate;
    res.endDate = endDate;
    res.isActive = isActive;
    res.createdAt = createdAt;
    res.updatedAt = updatedAt;
    return res;
  }
}

export class ValidatePromotionResultDto {
  isValid!: boolean;
  promotionId?: string;
  promotionCode?: string;
  discountType?: string;
  discountValue?: number;
  discountAmount!: number;
  reason?: string;

  static of(
    isValid: boolean,
    discountAmount: number,
    promotionId?: string,
    promotionCode?: string,
    discountType?: string,
    discountValue?: number,
    reason?: string,
  ): ValidatePromotionResultDto {
    const res = new ValidatePromotionResultDto();
    Object.assign(res, {
      isValid,
      discountAmount,
      promotionId,
      promotionCode,
      discountType,
      discountValue,
      reason,
    });
    return res;
  }
}
