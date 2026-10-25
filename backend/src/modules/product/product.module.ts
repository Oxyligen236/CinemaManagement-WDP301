import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { UserModule } from '../user/user.module';
import { StorageModule } from '../infra/storage/storage.module';
import { Product, ProductSchema } from './domain/schemas/product.schema';
import { Item, ItemSchema } from './domain/schemas/item.schema';
import { Combo, ComboSchema } from './domain/schemas/combo.schema';
import { ItemService } from './application/services/item.service';
import { ComboService } from './application/services/combo.service';
import { ProductService } from './application/services/product.service';
import { ItemManagerController } from './infra/controllers/item-manager.controller';
import { ComboManagerController } from './infra/controllers/combo-manager.controller';
import { StaffProductController } from './infra/controllers/staff-product.controller';

@Module({
  imports: [
    AuthModule,
    BranchModule,
    UserModule,
    StorageModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Item.name, schema: ItemSchema },
      { name: Combo.name, schema: ComboSchema },
    ]),
  ],
  controllers: [
    ItemManagerController,
    ComboManagerController,
    StaffProductController,
  ],
  providers: [ItemService, ComboService, ProductService],
  exports: [MongooseModule, ItemService, ComboService, ProductService],
})
export class ProductModule {}
