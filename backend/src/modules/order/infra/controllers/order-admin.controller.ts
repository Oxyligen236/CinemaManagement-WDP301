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
import { QueryAdminOrdersReq } from '../../application/dto/req.dto';
import { OrderSummaryRes } from '../../application/dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';

@Controller('admin/orders')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrderAdminController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async getAdminOrders(
    @Query() query: QueryAdminOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    return this.orderService.queryAdminOrders(query);
  }
}
