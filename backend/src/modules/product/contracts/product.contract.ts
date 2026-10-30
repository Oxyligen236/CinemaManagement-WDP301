export interface ProductSummaryDto {
  productId: string;
  productName: string;
  imageUrl?: string;
  unitPrice: number;
  branchId?: string;
}

export const PRODUCT_CONTRACT = Symbol('PRODUCT_CONTRACT');

export interface ProductContract {
  getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, ProductSummaryDto>>;
  deductConcessionStock(
    items: Array<{ productId: string; quantity: number }>,
    prismaTx?: any,
  ): Promise<void>;
}
