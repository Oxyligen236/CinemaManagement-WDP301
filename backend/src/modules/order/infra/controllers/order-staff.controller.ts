import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles, Role } from '../../../auth/infra/decorators/role.decorator';
import { OrderService } from '../../application/services/order.service';
import { QueryStaffOrdersReq } from '../../application/dto/req.dto';
import { OrderSummaryRes } from '../../application/dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';

@Controller('staff/orders')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrderStaffController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async getStaffOrders(
    @Query() query: QueryStaffOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    return this.orderService.queryStaffOrders(query);
  }
}
