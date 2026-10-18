import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './domain/schemas/order.schema';
import { SeatOrder, SeatOrderSchema } from './domain/schemas/seat-order.schema';
import {
  ProductOrder,
  ProductOrderSchema,
} from './domain/schemas/product-order.schema';
import { Ticket, TicketSchema } from '../ticket/domain/schemas/ticket.schema';
import { Product, ProductSchema } from '../product/domain/schemas/product.schema';
import { Promotion, PromotionSchema } from '../promotion/domain/schemas/promotion.schema';
import { TicketModule } from '../ticket/ticket.module';
import { ProductModule } from '../product/product.module';
import { PromotionModule } from '../promotion/promotion.module';
import { AuthModule } from '../auth/auth.module';
import { OrderService } from './application/services/order.service';
import { OrderController } from './infra/controllers/order.controller';
import { OrderStaffController } from './infra/controllers/order-staff.controller';
import { OrderAdminController } from './infra/controllers/order-admin.controller';
import { TICKET_CONTRACT } from './contracts/ticket.contract';
import { TicketContractImpl } from './contracts/ticket-contract.impl';
import { PRODUCT_CONTRACT } from './contracts/product.contract';
import { ProductContractImpl } from './contracts/product-contract.impl';
import { PROMOTION_CONTRACT } from './contracts/promotion.contract';
import { PromotionContractImpl } from './contracts/promotion-contract.impl';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: SeatOrder.name, schema: SeatOrderSchema },
      { name: ProductOrder.name, schema: ProductOrderSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Promotion.name, schema: PromotionSchema },
    ]),
    TicketModule,
    ProductModule,
    PromotionModule,
    AuthModule,
  ],
  controllers: [OrderController, OrderStaffController, OrderAdminController],
  providers: [
    OrderService,
    TicketContractImpl,
    ProductContractImpl,
    PromotionContractImpl,
    {
      provide: TICKET_CONTRACT,
      useClass: TicketContractImpl,
    },
    {
      provide: PRODUCT_CONTRACT,
      useClass: ProductContractImpl,
    },
    {
      provide: PROMOTION_CONTRACT,
      useClass: PromotionContractImpl,
    },
  ],
  exports: [OrderService],
})
export class OrderModule {}
