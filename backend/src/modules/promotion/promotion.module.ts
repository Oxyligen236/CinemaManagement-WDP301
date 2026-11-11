import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventModule } from '../infra/event/event.module';
import { PromotionAdminController } from './infra/controllers/promotion-admin.controller';
import { PromotionAdminService } from './application/services/promotion-admin.service';
import { PromotionPublicService } from './application/services/promotion-public.service';
import { PromotionListener } from './infra/listeners/promotion.listener';

@Module({
  imports: [AuthModule, EventModule],
  controllers: [PromotionAdminController],
  providers: [PromotionAdminService, PromotionPublicService, PromotionListener],
  exports: [PromotionPublicService, PromotionAdminService],
})
export class PromotionModule {}
