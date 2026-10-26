import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { RoomModule } from '../room/room.module';
import { MovieModule } from '../movie/movie.module';
import { Showtime, ShowtimeSchema } from './domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeSchema,
} from './domain/schemas/seat-showtime.schema';
import { SeatShowtimeQueryService } from './application/services/seat-showtime-query.service';
import { ShowtimeQueryService } from './application/services/showtime-query.service';
import { ShowtimeScheduleService } from './application/services/showtime-schedule.service';
import { ShowtimeController } from './infra/showtime.controller';
import { ShowtimeBookingService } from './application/services/showtime-booking.service';
export type { SeatBookingDetail } from './contract/seat-booking-detail';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    forwardRef(() => BranchModule),
    forwardRef(() => RoomModule),
    forwardRef(() => MovieModule),
    MongooseModule.forFeature([
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
    ]),
  ],
  controllers: [ShowtimeController],
  providers: [    
    ShowtimeQueryService,
    SeatShowtimeQueryService,
    ShowtimeBookingService,
    ShowtimeScheduleService,
  ],
  exports: [
    MongooseModule,
    ShowtimeQueryService,
    ShowtimeBookingService,
    ShowtimeScheduleService,
  ],
})
export class ShowtimeModule { }
