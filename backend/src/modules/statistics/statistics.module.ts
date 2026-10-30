import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
<<<<<<< HEAD
import { Order, OrderSchema } from '../order/domain/schemas/order.schema';
import {
  SeatOrder,
  SeatOrderSchema,
} from '../order/domain/schemas/seat-order.schema';
import {
  ProductOrder,
  ProductOrderSchema,
} from '../order/domain/schemas/product-order.schema';
import {
  SeatShowtime,
  SeatShowtimeSchema,
} from '../showtime/domain/schemas/seat-showtime.schema';
import {
  Showtime,
  ShowtimeSchema,
} from '../showtime/domain/schemas/showtime.schema';
import { Room, RoomSchema } from '../room/domain/schemas/room.schema';
import { Movie, MovieSchema } from '../movie/domain/schemas/movie.schema';
import { Item, ItemSchema } from '../product/domain/schemas/item.schema';
import { Combo, ComboSchema } from '../product/domain/schemas/combo.schema';
=======
>>>>>>> origin/main
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [AuthModule, UserModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
