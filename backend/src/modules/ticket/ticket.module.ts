import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from './domain/schemas/ticket.schema';
import { SeatShowtime, SeatShowtimeSchema } from '../showtime/domain/schemas/seat-showtime.schema';
import { Showtime, ShowtimeSchema } from '../showtime/domain/schemas/showtime.schema';
import { Movie, MovieSchema } from '../movie/domain/schemas/movie.schema';
import { Room, RoomSchema } from '../room/domain/schemas/room.schema';
import { Seat, SeatSchema } from '../room/domain/schemas/seat.schema';
import { AuthModule } from '../auth/auth.module';
import { EventModule } from '../infra/event/event.module';
import { TicketController } from './infra/controllers/ticket.controller';
import { TicketService } from './application/services/ticket.service';
import { SHOWTIME_CONTRACT } from './contracts/showtime.contract';
import { ShowtimeContractImpl } from './contracts/showtime-contract.impl';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: Movie.name, schema: MovieSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Seat.name, schema: SeatSchema },
    ]),
    AuthModule,
    EventModule,
  ],
  controllers: [TicketController],
  providers: [
    TicketService,
    ShowtimeContractImpl,
    {
      provide: SHOWTIME_CONTRACT,
      useClass: ShowtimeContractImpl,
    },
  ],
  exports: [TicketService, SHOWTIME_CONTRACT],
})
export class TicketModule {}

