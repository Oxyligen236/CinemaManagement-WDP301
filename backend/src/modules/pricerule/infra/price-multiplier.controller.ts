import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  CreatePriceValueReqDto,
  PriceFieldParamDto,
  PriceValueParamDto,
  UpdatePriceValueReqDto,
} from '../application/dto/req.dto';
import { PriceRuleOptionQueryService } from '../application/services/price-rule-option-query.service';
import { PriceRuleValueService } from '../application/services/price-rule-value.service';
import { Role, Roles } from '../../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { multiplierValidationExceptionFactory } from './pipes/multiplier-validation.exception-factory';

@Controller('price-multipliers')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: multiplierValidationExceptionFactory,
  }),
)
export class PriceMultiplierController {
  constructor(
    private readonly valueService: PriceRuleValueService,
    private readonly optionQueryService: PriceRuleOptionQueryService,
  ) {}

  @Get()
  listAll() {
    return this.optionQueryService.listPriceValues();
  }

  // Phải khai báo trước các route có tham số
  @Get('options')
  @Roles(Role.ADMIN, Role.MANAGER)
  listOptions() {
    return this.optionQueryService.listPriceValues();
  }

  @Post(':group/:fieldKey/values')
  create(
    @Param() params: PriceFieldParamDto,
    @Body() body: CreatePriceValueReqDto,
  ) {
    return this.valueService.createPriceValue(
      params.group,
      params.fieldKey,
      body,
    );
  }

  @Patch(':group/:fieldKey/values/:ruleId')
  update(
    @Param() params: PriceValueParamDto,
    @Body() body: UpdatePriceValueReqDto,
  ) {
    return this.valueService.updatePriceValue(
      params.group,
      params.fieldKey,
      params.ruleId,
      body,
    );
  }

  @Delete(':group/:fieldKey/values/:ruleId')
  @HttpCode(200)
  remove(@Param() params: PriceValueParamDto) {
    return this.valueService.deletePriceValue(
      params.group,
      params.fieldKey,
      params.ruleId,
    );
  }
}
