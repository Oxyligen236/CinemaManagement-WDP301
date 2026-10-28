import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { MovieModule } from '../movie/movie.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { Room, RoomSchema } from './domain/schemas/room.schema';
import { Seat, SeatSchema } from './domain/schemas/seat.schema';
import { RoomOptionQueryService } from './application/services/room-option-query.service';
import { BranchRoomController } from './infra/branch-room.controller';
import { BranchRoomService } from './application/branch-room.service';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    forwardRef(() => BranchModule),
    forwardRef(() => MovieModule),
    forwardRef(() => ShowtimeModule),
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Seat.name, schema: SeatSchema },
    ]),
  ],
  controllers: [BranchRoomController],
  providers: [BranchRoomService, RoomOptionQueryService],
  exports: [MongooseModule, RoomOptionQueryService],
})
export class RoomModule {}
