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
  minOrderValue?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount?: number;
}

export interface ValidatePromotionResultDto {
  isValid: boolean;
  promotionId?: string;
  promotionCode?: string;
  discountType?: string;
  discountValue?: number;
  discountAmount: number;
  reason?: string;
}

export const PROMOTION_CONTRACT = Symbol('PROMOTION_CONTRACT');

export interface PromotionContract {
  getPromotionById(promotionId: string): Promise<PromotionDetailDto | null>;
  validatePromotionCode(params: {
    code: string;
    orderAmount: number;
    userId: string;
  }): Promise<ValidatePromotionResultDto>;
  recordPromotionUsage(params: {
    promotionId: string;
    userId: string;
    orderId: string;
  }): Promise<void>;
}
