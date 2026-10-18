export interface ProductSummaryDto {
  productId: string;
  productName: string;
  imageUrl?: string;
  unitPrice: number;
}

export const PRODUCT_CONTRACT = Symbol('PRODUCT_CONTRACT');

export interface ProductContract {
  getProductsByIds(productIds: string[]): Promise<Map<string, ProductSummaryDto>>;
}
