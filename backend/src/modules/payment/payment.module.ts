import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';
import { PaymentService } from './application/services/payment.service';
import { VnpayReturnController } from './infra/controllers/vnpay-return.controller';
import { OrderPaymentController } from './infra/controllers/order-payment.controller';
import { PosPaymentController } from './infra/controllers/pos-payment.controller';

@Module({
  imports: [AuthModule, forwardRef(() => OrderModule)],
  controllers: [
    VnpayReturnController,
    OrderPaymentController,
    PosPaymentController,
  ],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
