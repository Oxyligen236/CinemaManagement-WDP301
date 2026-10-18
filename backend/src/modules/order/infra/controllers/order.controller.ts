import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { OrderService } from '../../application/services/order.service';
import { QueryMyOrdersReq } from '../../application/dto/req.dto';
import { OrderDetailRes, OrderSummaryRes } from '../../application/dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';

interface AuthenticatedRequest {
  user?: {
    userId?: string;
    sub?: string;
  };
}

@Controller('orders')
@UseGuards(JwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('me')
  async getMyOrders(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryMyOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const userId = req.user?.userId || req.user?.sub || 'user-default';
    return this.orderService.getMyOrderHistory(userId, query);
  }

  @Get(':orderId')
  async getOrderDetail(
    @Param('orderId') orderId: string,
  ): Promise<OrderDetailRes> {
    return this.orderService.getOrderDetail(orderId);
  }
}
