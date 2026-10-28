import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { RoomModule } from '../room/room.module';
import { MovieModule } from '../movie/movie.module';
import { UserModule } from '../user/user.module';
import { Showtime, ShowtimeSchema } from './domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeSchema,
} from './domain/schemas/seat-showtime.schema';
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
    forwardRef(() => BranchModule),
    forwardRef(() => RoomModule),
    forwardRef(() => MovieModule),
    forwardRef(() => UserModule),
    MongooseModule.forFeature([
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
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
