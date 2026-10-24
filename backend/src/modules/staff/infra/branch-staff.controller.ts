import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ValidationError,
} from '@nestjs/common';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../auth/domain/auth-user';
import { Role } from '../../user/domain/enums/role.enum';
import { BranchStaffService } from '../application/branch-staff.service';
import {
  BranchStaffQueryDto,
  CreateBranchStaffDto,
  UpdateBranchStaffDto,
} from '../application/dto/branch-staff.dto';
import { STAFF_MESSAGES } from '../domain/staff.rules';

const flatten = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}),
      ...flatten(error.children ?? [], path),
    ];
  });

/**
 * AF-1 / AF-2: mọi lỗi validate trả về MSG01, kèm chi tiết ở `errors`
 * để giao diện có thể chỉ ra trường bị sai.
 */
const staffValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: STAFF_MESSAGES.MSG01,
      errors: flatten(errors),
      fields: errors.map((error) => error.property),
    }),
});

/** UC19 - Manage Branch Staff */
@Controller('manager/staff')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.BRANCHMANAGER)
@UsePipes(staffValidationPipe)
export class BranchStaffController {
  constructor(private readonly branchStaffService: BranchStaffService) {}

  @Get('options')
  getOptions(@Req() req: AuthenticatedRequest) {
    return this.branchStaffService.getOptions((req.user as AuthUser).sub);
  }

  @Get()
  listStaff(
    @Req() req: AuthenticatedRequest,
    @Query() query: BranchStaffQueryDto,
  ) {
    return this.branchStaffService.listStaff((req.user as AuthUser).sub, query);
  }

  @Get(':userId')
  getStaff(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.branchStaffService.getStaff((req.user as AuthUser).sub, userId);
  }

  @Post()
  createStaff(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreateBranchStaffDto,
  ) {
    return this.branchStaffService.createStaff(
      (req.user as AuthUser).sub,
      input,
    );
  }

  @Patch(':userId')
  updateStaff(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() input: UpdateBranchStaffDto,
  ) {
    return this.branchStaffService.updateStaff(
      (req.user as AuthUser).sub,
      userId,
      input,
    );
  }
}
