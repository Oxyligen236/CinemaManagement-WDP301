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
import { AdminBranchController } from './infra/admin-branch.controller';
import { AdminBranchService } from './application/admin-branch.service';
import { BranchQueryService } from './application/services/branch-query.service';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: Showtime.name, schema: ShowtimeSchema },
    ]),
  ],
  controllers: [AdminBranchController],
  providers: [AdminBranchService, BranchQueryService],
  exports: [MongooseModule, AdminBranchService, BranchQueryService],
})
export class BranchModule {}
