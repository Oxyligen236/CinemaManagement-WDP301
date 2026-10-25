import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { PriceRuleOptionQueryService } from './application/services/price-rule-option-query.service';
import { PriceRuleValueService } from './application/services/price-rule-value.service';
import {
  DayPriceRule,
  DayPriceRuleSchema,
} from './domain/schemas/day-price-rule.schema';
import {
  SeatPriceRule,
  SeatPriceRuleSchema,
} from './domain/schemas/seat-price-rule.schema';
import { PriceMultiplierController } from './infra/price-multiplier.controller';

// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DayPriceRule.name, schema: DayPriceRuleSchema },
      { name: SeatPriceRule.name, schema: SeatPriceRuleSchema },
    ]),
    AuthModule,
  ],
  controllers: [PriceMultiplierController],
  providers: [PriceRuleValueService, PriceRuleOptionQueryService],
  exports: [MongooseModule, PriceRuleOptionQueryService],
})
export class PriceRuleModule {}
