import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { TempModule } from './modules/temp/temp.module';
import { DatabaseModule } from './modules/infra/database/database.module';
import { EventModule } from './modules/infra/event/event.module';
import { MailModule } from './modules/infra/mail/mail.module';
import { PaymentModule } from './modules/payment/payment.module';
import { BranchModule } from './modules/branch/branch.module';
import { RoomModule } from './modules/room/room.module';
import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { PromotionModule } from './modules/promotion/promotion.module';
import { MovieModule } from './modules/movie/movie.module';
import { ShowtimeModule } from './modules/showtime/showtime.module';
import { PriceRuleModule } from './modules/pricerule/pricerule.module';
import { WorkModule } from './modules/work/work.module';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    EventModule,
    MailModule,
    UserModule,
    TempModule,
    PaymentModule,
    BranchModule,
    RoomModule,
    ProductModule,
    OrderModule,
    TicketModule,
    PromotionModule,
    MovieModule,
    ShowtimeModule,
    PriceRuleModule,
    WorkModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
