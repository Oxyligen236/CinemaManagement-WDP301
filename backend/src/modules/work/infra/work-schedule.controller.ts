import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Req,
  UseGuards,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import { Role } from '../../user/domain/enums/role.enum';
import { WorkScheduleService } from '../application/work-schedule.service';
import { CreateWorkScheduleDto } from '../application/dto/create-work-schedule.dto';
import { AssignWorkScheduleDto } from '../application/dto/assign-work-schedule.dto';
import { AuthUser, AuthenticatedRequest } from '../../auth/domain/auth-user';

@Controller('admin/work-schedules')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
export class WorkScheduleController {
  constructor(private readonly service: WorkScheduleService) {}
  @Get() list(@Query('branchId') branchId?: string) {
    return this.service.list(branchId);
  }
  @Post() create(@Body() input: CreateWorkScheduleDto) {
    return this.service.create(input);
  }
  @Put(':scheduleId/assign') assign(
    @Param('scheduleId') scheduleId: string,
    @Body() input: AssignWorkScheduleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.assign(scheduleId, req.user!.sub, input.userIds);
  }
}

@Controller('staff/shifts')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
export class StaffShiftController {
  constructor(private readonly service: WorkScheduleService) {}
  @Post('start') start(
    @Body('scheduleId') scheduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.start(req.user!.sub, scheduleId);
  }
  @Post('end') end(@Req() req: AuthenticatedRequest) {
    return this.service.end(req.user!.sub);
  }
  @Get('my-shifts') list(@Req() req: AuthenticatedRequest) {
    return this.service.myShifts(req.user!.sub);
  }
  @Get('current-stats') stats(@Req() req: AuthenticatedRequest) {
    return this.service.stats(req.user!.sub);
  }
}

@Controller('manager/work-schedules')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.BRANCHMANAGER)
export class ManagerWorkScheduleController {
  constructor(private readonly service: WorkScheduleService) {}
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.service.listForManager(req.user!.sub);
  }
  @Get('export-template') async template(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const data = await this.service.exportTemplate(req.user!.sub);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="work-schedule-template.xlsx"',
    });
    res.end(data);
  }
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        cb(
          file.originalname.toLowerCase().endsWith('.xlsx')
            ? null
            : new BadRequestException('Chỉ chấp nhận file .xlsx'),
          file.originalname.toLowerCase().endsWith('.xlsx'),
        ),
    }),
  )
  import(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Thiếu file Excel');
    return this.service.importAssignments(req.user!.sub, file.buffer);
  }
  @Put(':scheduleId/assign') assign(
    @Param('scheduleId') scheduleId: string,
    @Body() input: AssignWorkScheduleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.assign(scheduleId, req.user!.sub, input.userIds);
  }
}

@Controller('manager/work-schedules/staff')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.BRANCHMANAGER)
export class ManagerWorkScheduleStaffController {
  constructor(private readonly service: WorkScheduleService) {}
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.service.listStaffForManager(req.user!.sub);
  }
}
