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
import { BranchShowtimeController } from './infra/branch-showtime.controller';
import { BranchShowtimeService } from './application/branch-showtime.service';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    BranchModule,
    forwardRef(() => RoomModule),
    MovieModule,
    MongooseModule.forFeature([
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
    ]),
  ],
  controllers: [BranchShowtimeController],
  providers: [BranchShowtimeService],
  exports: [MongooseModule],
})
export class ShowtimeModule {}
