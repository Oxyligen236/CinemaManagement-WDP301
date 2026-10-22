import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './domain/schemas/product.schema';
import { ProductService } from './application/services/product.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [],
  providers: [ProductService],
  exports: [MongooseModule, ProductService],
})
export class ProductModule {}
