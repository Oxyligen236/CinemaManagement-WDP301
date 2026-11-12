import {
  Controller,
  Ip,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { PaymentService } from '../../application/services/payment.service';

interface AuthenticatedRequest {
  user?: {
    userId?: string;
    sub?: string;
  };
}

@Controller('orders')
@UseGuards(JwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrderPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':orderId/vnpay')
  async createVnpayPayment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Ip() ip: string,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException(
        'User ID is missing from authorization context',
      );
    }
    return this.paymentService.createVnpayPayment(userId, orderId, ip);
  }
}
