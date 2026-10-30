import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Room, RoomSchema } from './domain/schemas/room.schema';
import { Seat, SeatSchema } from './domain/schemas/seat.schema';
import { User, UserSchema } from '../user/domain/schemas/user.schema';
import { Branch, BranchSchema } from '../branch/domain/schemas/branch.schema';
import { Movie, MovieSchema } from '../movie/domain/schemas/movie.schema';
import {
  Showtime,
  ShowtimeSchema,
} from '../showtime/domain/schemas/showtime.schema';
import {
  SeatShowtime,
  SeatShowtimeSchema,
} from '../showtime/domain/schemas/seat-showtime.schema';
import { RoomOptionQueryService } from './application/services/room-option-query.service';
import { BranchRoomController } from './infra/branch-room.controller';
import { BranchRoomService } from './application/branch-room.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Movie.name, schema: MovieSchema },
      { name: Showtime.name, schema: ShowtimeSchema },
      { name: SeatShowtime.name, schema: SeatShowtimeSchema },
    ]),
  ],
  controllers: [BranchRoomController],
  providers: [BranchRoomService, RoomOptionQueryService],
  exports: [MongooseModule, RoomOptionQueryService],
})
export class RoomModule {}
