import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkScheduleService } from './application/work-schedule.service';
import {
  WorkScheduleController,
  StaffShiftController,
  ManagerWorkScheduleController,
  ManagerWorkScheduleStaffController,
} from './infra/work-schedule.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    WorkScheduleController,
    StaffShiftController,
    ManagerWorkScheduleController,
    ManagerWorkScheduleStaffController,
  ],
  providers: [WorkScheduleService],
  exports: [WorkScheduleService],
})
export class WorkModule {}
