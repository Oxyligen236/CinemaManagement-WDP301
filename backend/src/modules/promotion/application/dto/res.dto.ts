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

  static from(params: {
    promotionId: string;
    promotionCode: string;
    discountValue: number;
    discountType: DiscountType;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): PromotionResponseDto {
    const res = new PromotionResponseDto();
    res.promotionId = params.promotionId;
    res.promotionCode = params.promotionCode;
    res.discountValue = params.discountValue;
    res.discountType = params.discountType;
    res.startDate = params.startDate;
    res.endDate = params.endDate;
    res.isActive = params.isActive;
    res.createdAt = params.createdAt;
    res.updatedAt = params.updatedAt;
    return res;
  }

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
    return PromotionResponseDto.from({
      promotionId,
      promotionCode,
      discountValue,
      discountType,
      startDate,
      endDate,
      isActive,
      createdAt,
      updatedAt,
    });
  }
}
