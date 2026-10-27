import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Promotion, PromotionSchema } from './domain/schemas/promotion.schema';
import { AuthModule } from '../auth/auth.module';
import { EventModule } from '../infra/event/event.module';
import { PromotionAdminController } from './infra/controllers/promotion-admin.controller';
import { PromotionAdminService } from './application/services/promotion-admin.service';
import { PromotionPublicService } from './application/services/promotion-public.service';
import { PROMOTION_CONTRACT } from './contracts/promotion.contract';
import { PromotionContractImpl } from './contracts/promotion-contract.impl';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Promotion.name, schema: PromotionSchema },
    ]),
    AuthModule,
    EventModule,
  ],
  controllers: [PromotionAdminController],
  providers: [
    PromotionAdminService,
    PromotionPublicService,
    PromotionContractImpl,
    {
      provide: PROMOTION_CONTRACT,
      useClass: PromotionContractImpl,
    },
  ],
  exports: [PromotionPublicService, PromotionAdminService, PROMOTION_CONTRACT],
})
export class PromotionModule {}
