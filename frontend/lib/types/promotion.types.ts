export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface Promotion {
  promotionId: string;
  promotionCode: string;
  discountValue: number;
  discountType: DiscountType;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionDto {
  promotionCode: string;
  discountValue: number;
  discountType: DiscountType;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

export interface UpdatePromotionDto {
  discountValue?: number;
  discountType?: DiscountType;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface ChangePromotionStatusDto {
  isActive: boolean;
}

export interface QueryPromotionsDto {
  page?: number;
  limit?: number;
  search?: string;
  discountType?: DiscountType;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'startDate' | 'endDate' | 'promotionCode';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPromotionResponse {
  items: Promotion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PromotionStats {
  total: number;
  active: number;
  inactive: number;
  expired: number;
  percentageCount: number;
  fixedAmountCount: number;
}
