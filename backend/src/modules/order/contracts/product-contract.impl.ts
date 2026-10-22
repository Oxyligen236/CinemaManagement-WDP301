import { Injectable } from '@nestjs/common';
import { ProductService } from '../../product/application/services/product.service';
import { ProductContract, ProductSummaryDto } from './product.contract';

@Injectable()
export class ProductContractImpl implements ProductContract {
  constructor(private readonly productService: ProductService) {}

  async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, ProductSummaryDto>> {
    const productsMap = await this.productService.getProductsByIds(productIds);
    const result = new Map<string, ProductSummaryDto>();
    for (const [id, prod] of productsMap.entries()) {
      result.set(id, {
        productId: prod.productId,
        productName: prod.productName,
        imageUrl: prod.imageUrl,
        unitPrice: prod.unitPrice,
      });
    }
    return result;
  }
}
