import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './domain/schemas/order.schema';
import { SeatOrder, SeatOrderSchema } from './domain/schemas/seat-order.schema';
import {
  ProductOrder,
  ProductOrderSchema,
} from './domain/schemas/product-order.schema';
import { TicketModule } from '../ticket/ticket.module';
import { ProductModule } from '../product/product.module';
import { PromotionModule } from '../promotion/promotion.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { PaymentModule } from '../payment/payment.module';
import { QueueModule } from '../infra/queue/queue.module';
import { EventModule } from '../infra/event/event.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { OrderService } from './application/services/order.service';
import { PosOrderService } from './application/services/pos-order.service';
import { OrderExpirationConsumer } from './application/handlers/order-expiration.consumer';
import { OrderController } from './infra/controllers/order.controller';
import { OrderStaffController } from './infra/controllers/order-staff.controller';
import { OrderAdminController } from './infra/controllers/order-admin.controller';
import { PosStaffController } from './infra/controllers/pos-staff.controller';
import { SHOWTIME_BOOKING } from './contracts/showtime-booking.contract';
import { ShowtimeBookingService } from '../showtime/application/services/showtime-booking.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: SeatOrder.name, schema: SeatOrderSchema },
      { name: ProductOrder.name, schema: ProductOrderSchema },
    ]),
    TicketModule,
    ProductModule,
    PromotionModule,
    ShowtimeModule,
    PaymentModule,
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
