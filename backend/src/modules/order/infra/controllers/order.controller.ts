import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  Ip,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { OrderService } from '../../application/services/order.service';
import {
  ApplyPromotionReq,
  CreateBookingOrderReq,
  QueryMyOrdersReq,
} from '../../application/dto/req.dto';
import {
  BookingSummaryRes,
  OrderDetailRes,
  OrderSummaryRes,
} from '../../application/dto/res.dto';
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

  @Post('booking')
  async createBooking(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateBookingOrderReq,
  ): Promise<BookingSummaryRes> {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException(
        'User ID is missing from authorization context',
      );
    }
    return this.orderService.createBookingOrder(userId, body);
  }

  @Get('me')
  async getMyOrders(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryMyOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    const userId = req.user?.userId || req.user?.sub || 'user-default';
    return this.orderService.getMyOrderHistory(userId, query);
  }

  @Get(':orderId/summary')
  async getBookingSummary(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ): Promise<BookingSummaryRes> {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException(
        'User ID is missing from authorization context',
      );
    }
    return this.orderService.getBookingSummary(userId, orderId);
  }

  @Post(':orderId/apply-promotion')
  async applyPromotion(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: ApplyPromotionReq,
  ): Promise<BookingSummaryRes> {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException(
        'User ID is missing from authorization context',
      );
    }
    return this.orderService.applyPromotion(userId, orderId, body);
  }

  @Post(':orderId/vnpay')
  async createVnpayPayment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Ip() ip: string,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) throw new UnauthorizedException('User ID is missing from authorization context');
    return this.orderService.createVnpayPayment(userId, orderId, ip);
  }

  @Get(':orderId')
  async getOrderDetail(
    @Param('orderId') orderId: string,
  ): Promise<OrderDetailRes> {
    return this.orderService.getOrderDetail(orderId);
  }
}
