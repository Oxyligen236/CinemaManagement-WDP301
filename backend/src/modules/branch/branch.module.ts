import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { ShowtimeModule } from '../showtime/showtime.module';
import { Branch, BranchSchema } from './domain/schemas/branch.schema';
import { AdminBranchController } from './infra/admin-branch.controller';
import { AdminBranchService } from './application/admin-branch.service';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    forwardRef(() => RoomModule),
    forwardRef(() => ShowtimeModule),
    MongooseModule.forFeature([{ name: Branch.name, schema: BranchSchema }]),
  ],
  controllers: [AdminBranchController],
  providers: [AdminBranchService],
  exports: [MongooseModule, AdminBranchService],
})
export class BranchModule {}
