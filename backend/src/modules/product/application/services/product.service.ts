import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../../domain/schemas/product.schema';
import { ProductSummaryDto } from '../dto/product-summary.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, ProductSummaryDto>> {
    const map = new Map<string, ProductSummaryDto>();
    if (!productIds || productIds.length === 0) {
      return map;
    }

    const products = await this.productModel
      .find({ productId: { $in: productIds } })
      .exec();

    for (const product of products) {
      map.set(product.productId, {
        productId: product.productId,
        productName: product.productName,
        imageUrl: undefined,
        unitPrice: product.price,
      });
    }

    return map;
  }
}
