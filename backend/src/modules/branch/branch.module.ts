import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { AdminBranchController } from './infra/admin-branch.controller';
import { AdminBranchService } from './application/admin-branch.service';
import { BranchQueryService } from './application/services/branch-query.service';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => RoomModule),
    forwardRef(() => ShowtimeModule),
  ],
  controllers: [AdminBranchController],
  providers: [AdminBranchService, BranchQueryService],
  exports: [AdminBranchService, BranchQueryService],
})
export class BranchModule {}
