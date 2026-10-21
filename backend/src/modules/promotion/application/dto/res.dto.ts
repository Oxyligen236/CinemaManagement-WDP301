import { DiscountType } from '../../domain/enums/discount-type.enum';
import { Promotion, PromotionDocument } from '../../domain/schemas/promotion.schema';

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

  static of(entity: Promotion | PromotionDocument | Record<string, any>): PromotionResponseDto {
    const doc = (entity as any)?._doc ?? entity ?? {};
    const res = new PromotionResponseDto();
    res.promotionId = doc.promotionId;
    res.promotionCode = doc.promotionCode;
    res.discountValue = doc.discountValue;
    res.discountType = doc.discountType;
    res.startDate = doc.startDate;
    res.endDate = doc.endDate;
    res.isActive = doc.isActive;
    res.createdAt = doc.createdAt;
    res.updatedAt = doc.updatedAt;
    return res;
  }

  static ofArray(entities: (Promotion | PromotionDocument | Record<string, any>)[] | null | undefined): PromotionResponseDto[] {
    return (entities ?? []).map((entity) => PromotionResponseDto.of(entity));
  }
}
