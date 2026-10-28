import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import { Role } from '../../user/domain/enums/role.enum';
import { WorkScheduleService } from '../application/work-schedule.service';
import { CreateWorkScheduleDto } from '../application/dto/create-work-schedule.dto';

@Controller('admin/work-schedules')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
export class WorkScheduleController {
  constructor(private readonly service: WorkScheduleService) {}
  @Get() list(@Query('branchId') branchId?: string) { return this.service.list(branchId); }
  @Post() create(@Body() input: CreateWorkScheduleDto) { return this.service.create(input); }
}
