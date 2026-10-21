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
