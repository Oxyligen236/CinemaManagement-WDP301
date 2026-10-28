import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  WorkSchedule,
  WorkScheduleSchema,
} from './domain/schemas/work-schedule.schema';
import { Branch, BranchSchema } from '../branch/domain/schemas/branch.schema';
import { WorkScheduleService } from './application/work-schedule.service';
import { WorkScheduleController } from './infra/work-schedule.controller';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: WorkSchedule.name, schema: WorkScheduleSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [WorkScheduleController],
  providers: [WorkScheduleService],
  exports: [MongooseModule],
})
export class WorkModule {}
