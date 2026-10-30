import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { UserModule } from '../user/user.module';
import { StorageModule } from '../infra/storage/storage.module';
import { ItemService } from './application/services/item.service';
import { ComboService } from './application/services/combo.service';
import { ProductService } from './application/services/product.service';
import { ItemManagerController } from './infra/controllers/item-manager.controller';
import { ComboManagerController } from './infra/controllers/combo-manager.controller';
import { StaffProductController } from './infra/controllers/staff-product.controller';
import { PRODUCT_CONTRACT } from './contracts/product.contract';
import { ProductContractImpl } from './contracts/product-contract.impl';

@Module({
  imports: [AuthModule, BranchModule, UserModule, StorageModule],
  controllers: [
    ItemManagerController,
    ComboManagerController,
    StaffProductController,
  ],
  providers: [
    ItemService,
    ComboService,
    ProductService,
    {
      provide: PRODUCT_CONTRACT,
      useClass: ProductContractImpl,
    },
  ],
  exports: [ProductService, ItemService, ComboService, PRODUCT_CONTRACT],
})
export class ProductModule {}
