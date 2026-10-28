import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles, Role } from '../../../auth/infra/decorators/role.decorator';
import { OrderService } from '../../application/services/order.service';
import {
  CancelOrderReq,
  QueryAdminOrdersReq,
} from '../../application/dto/req.dto';
import { CancelOrderRes, OrderSummaryRes } from '../../application/dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';

interface AuthenticatedRequest {
  user?: {
    userId?: string;
    sub?: string;
  };
}

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

  @Post(':orderId/cancel')
  async cancelAdminOrder(
    @Param('orderId') orderId: string,
    @Body() body: CancelOrderReq,
    @Req() req: AuthenticatedRequest,
  ): Promise<CancelOrderRes> {
    const adminId = req.user?.userId || req.user?.sub;
    if (!adminId) {
      throw new UnauthorizedException(
        'Admin ID is missing from authorization context',
      );
    }
    return this.orderService.cancelOrder(
      orderId,
      { userId: adminId, role: Role.ADMIN },
      body?.reason,
    );
  }
}
