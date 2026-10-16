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
}
