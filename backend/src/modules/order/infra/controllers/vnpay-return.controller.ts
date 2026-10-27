import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OrderService } from '../../application/services/order.service';

@Controller('payments/vnpay')
export class VnpayReturnController {
  constructor(private readonly orderService: OrderService) {}

  @Get('ipn')
  handleIpn(@Query() query: Record<string, string | string[]>) {
    return this.orderService.handleVnpayIpn(query);
  }

  @Get('return')
  async handleReturn(
    @Query() query: Record<string, string | string[]>,
    @Res() response: Response,
  ) {
    const orderId = typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef : '';
    const result = await this.orderService.handleVnpayReturn(query);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      orderId: result.orderId || orderId,
      status: result.isSuccess ? 'success' : 'failed',
    });
    return response.redirect(`${frontendUrl}/booking/payment-return?${params}`);
  }
}
