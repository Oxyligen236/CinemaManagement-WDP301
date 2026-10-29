import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  WorkSchedule,
  WorkScheduleSchema,
} from './domain/schemas/work-schedule.schema';
import { Branch, BranchSchema } from '../branch/domain/schemas/branch.schema';
import { WorkScheduleService } from './application/work-schedule.service';
import {
  WorkScheduleController,
  StaffShiftController,
  ManagerWorkScheduleController,
  ManagerWorkScheduleStaffController,
} from './infra/work-schedule.controller';
import {
  ShiftAttendance,
  ShiftAttendanceSchema,
} from './domain/schemas/shift-attendance.schema';
import { User, UserSchema } from '../user/domain/schemas/user.schema';
import { ShiftAssignment, ShiftAssignmentSchema } from './domain/schemas/shift-assignment.schema';
import { Order, OrderSchema } from '../order/domain/schemas/order.schema';
import {
  SeatOrder,
  SeatOrderSchema,
} from '../order/domain/schemas/seat-order.schema';
import {
  ProductOrder,
  ProductOrderSchema,
} from '../order/domain/schemas/product-order.schema';

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
      { name: ShiftAttendance.name, schema: ShiftAttendanceSchema },
      { name: User.name, schema: UserSchema },
      { name: ShiftAssignment.name, schema: ShiftAssignmentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: SeatOrder.name, schema: SeatOrderSchema },
      { name: ProductOrder.name, schema: ProductOrderSchema },
    ]),
  ],
  controllers: [
    WorkScheduleController,
    StaffShiftController,
    ManagerWorkScheduleController,
    ManagerWorkScheduleStaffController,
  ],
  providers: [WorkScheduleService],
  exports: [MongooseModule],
})
export class WorkModule {}
