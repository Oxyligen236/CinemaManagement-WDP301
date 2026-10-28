import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Promotion, PromotionSchema } from './domain/schemas/promotion.schema';
import {
  PromotionUsage,
  PromotionUsageSchema,
} from './domain/schemas/promotion-usage.schema';
import { AuthModule } from '../auth/auth.module';
import { EventModule } from '../infra/event/event.module';
import { PromotionAdminController } from './infra/controllers/promotion-admin.controller';
import { PromotionAdminService } from './application/services/promotion-admin.service';
import { PromotionPublicService } from './application/services/promotion-public.service';
import { PromotionListener } from './infra/listeners/promotion.listener';
import { PROMOTION_CONTRACT } from './contracts/promotion.contract';
import { PromotionContractImpl } from './contracts/promotion-contract.impl';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Promotion.name, schema: PromotionSchema },
      { name: PromotionUsage.name, schema: PromotionUsageSchema },
    ]),
    AuthModule,
    EventModule,
  ],
  controllers: [PromotionAdminController],
  providers: [
    PromotionAdminService,
    PromotionPublicService,
    PromotionContractImpl,
    PromotionListener,
    {
      provide: PROMOTION_CONTRACT,
      useClass: PromotionContractImpl,
    },
  ],
  exports: [PromotionPublicService, PromotionAdminService, PROMOTION_CONTRACT],
})
export class PromotionModule {}
