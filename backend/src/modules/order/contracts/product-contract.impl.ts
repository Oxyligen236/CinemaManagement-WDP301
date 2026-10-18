import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../../product/domain/schemas/product.schema';
import { ProductContract, ProductSummaryDto } from './product.contract';

@Injectable()
export class ProductContractImpl implements ProductContract {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<ProductDocument>) {}

  async getProductsByIds(productIds: string[]): Promise<Map<string, ProductSummaryDto>> {
    const result = new Map<string, ProductSummaryDto>();
    if (!productIds.length) return result;
    const products = await this.productModel.find({ productId: { $in: productIds } }).exec();
    for (const product of products) {
      result.set(product.productId, {
        productId: product.productId,
        productName: product.productName,
        unitPrice: product.price,
      });
    }
    return result;
  }
}
