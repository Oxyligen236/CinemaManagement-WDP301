import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { Showtime, ShowtimeSchema } from './domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeSchema,
} from './domain/schemas/seat-showtime.schema';
import { Branch, BranchSchema } from '../branch/domain/schemas/branch.schema';
import { Room, RoomSchema } from '../room/domain/schemas/room.schema';
import { Seat, SeatSchema } from '../room/domain/schemas/seat.schema';
import { Movie, MovieSchema } from '../movie/domain/schemas/movie.schema';
import { Genre, GenreSchema } from '../movie/domain/schemas/genre.schema';
import { SeatShowtimeQueryService } from './application/services/seat-showtime-query.service';
import { ShowtimeQueryService } from './application/services/showtime-query.service';
import { PublicShowtimeQueryService } from './application/services/public-showtime-query.service';
import { StaffShowtimeQueryService } from './application/services/staff-showtime-query.service';
import { ShowtimeController } from './infra/showtime.controller';
import { StaffShowtimeController } from './infra/staff-showtime.controller';
import { ShowtimeBookingService } from './application/services/showtime-booking.service';
import { ShowtimeScheduleService } from './application/services/showtime-schedule.service';
import { SHOWTIME_CONTRACT } from './contracts/showtime.contract';
import { ShowtimeContractImpl } from './contracts/showtime-contract.impl';
export type { SeatBookingDetail } from './contract/seat-booking-detail';

@Module({
  imports: [
    AuthModule,
    UserModule,
    MongooseModule.forFeature([
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: Movie.name, schema: MovieSchema },
      { name: Genre.name, schema: GenreSchema },
    ]),
  ],
  controllers: [ShowtimeController, StaffShowtimeController],
  providers: [
    ShowtimeQueryService,
    SeatShowtimeQueryService,
    ShowtimeBookingService,
    ShowtimeScheduleService,
    PublicShowtimeQueryService,
    StaffShowtimeQueryService,
    ShowtimeContractImpl,
    {
      provide: SHOWTIME_CONTRACT,
      useClass: ShowtimeContractImpl,
    },
  ],
  exports: [
    MongooseModule,
    ShowtimeQueryService,
    ShowtimeBookingService,
    ShowtimeScheduleService,
    PublicShowtimeQueryService,
    StaffShowtimeQueryService,
    SHOWTIME_CONTRACT,
  ],
})
export class ShowtimeModule {}
