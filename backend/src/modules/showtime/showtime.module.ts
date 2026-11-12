import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { RoomModule } from '../room/room.module';
import { MovieModule } from '../movie/movie.module';
import { UserModule } from '../user/user.module';
import { SeatShowtimeQueryService } from './application/services/seat-showtime-query.service';
import { ShowtimeQueryService } from './application/services/showtime-query.service';
import { PublicShowtimeQueryService } from './application/services/public-showtime-query.service';
import { StaffShowtimeQueryService } from './application/services/staff-showtime-query.service';
import { ShowtimeController } from './infra/showtime.controller';
import { StaffShowtimeController } from './infra/staff-showtime.controller';
import { ShowtimeBookingService } from './application/services/showtime-booking.service';
import { ShowtimeScheduleService } from './application/services/showtime-schedule.service';
export {
  SeatBookingDetailDto,
  SeatBookingDetail,
  SeatShowtimeDetailDto,
  SeatShowtimeDetail,
} from './application/dto/res.dto';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => BranchModule),
    forwardRef(() => RoomModule),
    forwardRef(() => MovieModule),
    forwardRef(() => UserModule),
  ],
  controllers: [ShowtimeController, StaffShowtimeController],
  providers: [
    ShowtimeQueryService,
    SeatShowtimeQueryService,
    ShowtimeBookingService,
    ShowtimeScheduleService,
    PublicShowtimeQueryService,
    StaffShowtimeQueryService,
  ],
  exports: [
    ShowtimeQueryService,
    ShowtimeBookingService,
    ShowtimeScheduleService,
    PublicShowtimeQueryService,
    StaffShowtimeQueryService,
  ],
})
export class ShowtimeModule {}
