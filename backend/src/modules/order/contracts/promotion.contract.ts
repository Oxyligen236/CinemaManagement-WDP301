export interface PromotionDetailDto {
  promotionId: string;
  promotionCode: string;
  discountValue: number;
  discountType: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const PROMOTION_CONTRACT = Symbol('PROMOTION_CONTRACT');

export interface PromotionContract {
  getPromotionById(promotionId: string): Promise<PromotionDetailDto | null>;
}
