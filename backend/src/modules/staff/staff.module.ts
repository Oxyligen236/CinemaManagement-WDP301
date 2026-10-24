import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../user/domain/schemas/user.schema';
import { Branch, BranchSchema } from '../branch/domain/schemas/branch.schema';
import { BranchStaffController } from './infra/branch-staff.controller';
import { BranchStaffService } from './application/branch-staff.service';

/** UC19 - Manage Branch Staff (Branch Manager) */
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [BranchStaffController],
  providers: [BranchStaffService],
})
export class StaffModule {}
