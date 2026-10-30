import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchStaffController } from './infra/branch-staff.controller';
import { BranchStaffService } from './application/branch-staff.service';

/** UC19 - Manage Branch Staff (Branch Manager) */
@Module({
  imports: [AuthModule],
  controllers: [BranchStaffController],
  providers: [BranchStaffService],
  exports: [BranchStaffService],
})
export class StaffModule {}
