import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PriceRuleOptionQueryService } from './application/services/price-rule-option-query.service';
import { PriceRuleValueService } from './application/services/price-rule-value.service';
import { PriceMultiplierController } from './infra/price-multiplier.controller';

@Module({
  imports: [AuthModule],
  controllers: [PriceMultiplierController],
  providers: [PriceRuleValueService, PriceRuleOptionQueryService],
  exports: [PriceRuleOptionQueryService],
})
export class PriceRuleModule {}
