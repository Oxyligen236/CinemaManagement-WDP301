import { Module } from '@nestjs/common';
import { TicketModule } from '../ticket/ticket.module';
import { ProductModule } from '../product/product.module';
import { PromotionModule } from '../promotion/promotion.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { BranchModule } from '../branch/branch.module';
import { PaymentModule } from '../payment/payment.module';
import { QueueModule } from '../infra/queue/queue.module';
import { EventModule } from '../infra/event/event.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { OrderService } from './application/services/order.service';
import { PosOrderService } from './application/services/pos-order.service';
import { OrderExpirationConsumer } from './application/handlers/order-expiration.consumer';
import { OrderController } from './infra/controllers/order.controller';
import { VnpayReturnController } from './infra/controllers/vnpay-return.controller';
import { OrderStaffController } from './infra/controllers/order-staff.controller';
import { OrderAdminController } from './infra/controllers/order-admin.controller';
import { PosStaffController } from './infra/controllers/pos-staff.controller';
import { SHOWTIME_BOOKING } from './contracts/showtime-booking.contract';
import { ShowtimeBookingService } from '../showtime/application/services/showtime-booking.service';

@Module({
  imports: [
    TicketModule,
    ProductModule,
    PromotionModule,
    ShowtimeModule,
    BranchModule,
    PaymentModule,
    QueueModule,
    EventModule,
    AuthModule,
    UserModule,
  ],
  controllers: [
    OrderController,
    VnpayReturnController,
    OrderStaffController,
    OrderAdminController,
    PosStaffController,
  ],
  providers: [
    OrderService,
    PosOrderService,
    OrderExpirationConsumer,
    {
      provide: SHOWTIME_BOOKING,
      useExisting: ShowtimeBookingService,
    },
  ],
  exports: [OrderService, PosOrderService],
})
export class OrderModule {}
