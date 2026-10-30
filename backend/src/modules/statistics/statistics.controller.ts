import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/infra/decorators/current-user.decorator';
import { Role, Roles } from '../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../auth/infra/guards/role.guard';
import { AuthenticatedUser } from '../auth/domain/types/authenticated-user.type';
import { FinancialStatisticsQueryDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN, Role.BRANCHMANAGER)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get('financial')
  getFinancial(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinancialStatisticsQueryDto,
  ) {
    return this.service.getFinancial(user, query);
  }
}
