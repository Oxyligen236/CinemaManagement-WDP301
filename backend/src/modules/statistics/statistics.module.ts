import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
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
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: SeatOrder.name, schema: SeatOrderSchema },
      { name: ProductOrder.name, schema: ProductOrderSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Movie.name, schema: MovieSchema },
      { name: Item.name, schema: ItemSchema },
      { name: Combo.name, schema: ComboSchema },
    ]),
    AuthModule,
    UserModule,
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
