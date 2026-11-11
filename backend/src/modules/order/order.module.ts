import { Module, forwardRef } from '@nestjs/common';
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
import { OrderExpirationConsumer } from './application/handlers/order-expiration.consumer';
import { OrderController } from './infra/controllers/order.controller';
import { OrderStaffController } from './infra/controllers/order-staff.controller';
import { OrderAdminController } from './infra/controllers/order-admin.controller';
import { PosStaffController } from './infra/controllers/pos-staff.controller';
import { TicketController } from './infra/controllers/ticket.controller';

@Module({
  imports: [
    ProductModule,
    PromotionModule,
    ShowtimeModule,
    BranchModule,
    forwardRef(() => PaymentModule),
    QueueModule,
    EventModule,
    AuthModule,
    UserModule,
  ],
  controllers: [
    OrderController,
    OrderStaffController,
    OrderAdminController,
    PosStaffController,
    TicketController,
  ],
  providers: [OrderService, OrderExpirationConsumer],
  exports: [OrderService],
})
export class OrderModule {}
