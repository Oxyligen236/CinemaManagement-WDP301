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
    const orderId =
      typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef : '';
    let result: {
      orderId?: string;
      isSuccess: boolean;
      message?: string;
      responseCode?: string;
    };
    try {
      result = await this.orderService.handleVnpayReturn(query);
    } catch {
      result = {
        orderId,
        isSuccess: false,
        responseCode:
          typeof query.vnp_ResponseCode === 'string'
            ? query.vnp_ResponseCode
            : 'SYSTEM_ERROR',
        message:
          typeof query.vnp_ResponseCode === 'string'
            ? 'Giao dịch không thành công'
            : 'Không thể xác nhận giao dịch',
      };
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      orderId: result.orderId || orderId,
      status: result.isSuccess ? 'success' : 'failed',
      code:
        result.responseCode ||
        (typeof query.vnp_ResponseCode === 'string'
          ? query.vnp_ResponseCode
          : 'UNKNOWN'),
      message: result.message || 'Thanh toán không thành công',
    });
    return response.redirect(`${frontendUrl}/booking/payment-return?${params}`);
  }
}
