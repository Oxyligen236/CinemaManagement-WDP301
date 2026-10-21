import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../user/domain/schemas/user.schema';
import { Branch, BranchSchema } from '../branch/domain/schemas/branch.schema';
import { Room, RoomSchema } from '../room/domain/schemas/room.schema';
import { Seat, SeatSchema } from '../room/domain/schemas/seat.schema';
import { Movie, MovieSchema } from '../movie/domain/schemas/movie.schema';
import { Showtime, ShowtimeSchema } from './domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeSchema,
} from './domain/schemas/seat-showtime.schema';
import { BranchShowtimeController } from './infra/branch-showtime.controller';
import { BranchShowtimeService } from './application/branch-showtime.service';

// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: Movie.name, schema: MovieSchema },
    ]),
  ],
  controllers: [BranchShowtimeController],
  providers: [BranchShowtimeService],
  exports: [MongooseModule],
})
export class ShowtimeModule {}
