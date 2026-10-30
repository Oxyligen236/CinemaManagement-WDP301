<<<<<<< HEAD
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Room, RoomSchema } from '../room/domain/schemas/room.schema';
import { Seat, SeatSchema } from '../room/domain/schemas/seat.schema';
import {
  Showtime,
  ShowtimeSchema,
} from '../showtime/domain/schemas/showtime.schema';
import { Branch, BranchSchema } from './domain/schemas/branch.schema';
=======
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { ShowtimeModule } from '../showtime/showtime.module';
>>>>>>> origin/main
import { AdminBranchController } from './infra/admin-branch.controller';
import { AdminBranchService } from './application/admin-branch.service';
import { BranchQueryService } from './application/services/branch-query.service';

@Module({
  imports: [
    AuthModule,
<<<<<<< HEAD
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: Showtime.name, schema: ShowtimeSchema },
    ]),
=======
    forwardRef(() => RoomModule),
    forwardRef(() => ShowtimeModule),
>>>>>>> origin/main
  ],
  controllers: [AdminBranchController],
  providers: [AdminBranchService, BranchQueryService],
  exports: [AdminBranchService, BranchQueryService],
})
export class BranchModule {}
