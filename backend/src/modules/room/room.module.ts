import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { MovieModule } from '../movie/movie.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { RoomOptionQueryService } from './application/services/room-option-query.service';
import { BranchRoomController } from './infra/branch-room.controller';
import { BranchRoomService } from './application/branch-room.service';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => BranchModule),
    forwardRef(() => MovieModule),
    forwardRef(() => ShowtimeModule),
  ],
  controllers: [BranchRoomController],
  providers: [BranchRoomService, RoomOptionQueryService],
  exports: [BranchRoomService, RoomOptionQueryService],
})
export class RoomModule {}
