import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, AuthUser } from '../../auth/domain/auth-user';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Role } from '../../user/domain/enums/role.enum';
import { StaffShowtimeItemResDto } from '../application/dto/res.dto';
import { StaffShowtimeQueryService } from '../application/services/staff-showtime-query.service';

@Controller('staff/showtimes')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
export class StaffShowtimeController {
  constructor(
    private readonly staffShowtimeQueryService: StaffShowtimeQueryService,
  ) {}

  @Get('today')
  async getTodayShowtimes(
    @Req() req: AuthenticatedRequest,
  ): Promise<StaffShowtimeItemResDto[]> {
    const authUser = req.user as AuthUser;
    return this.staffShowtimeQueryService.getStaffTodayShowtimes(authUser.sub);
  }
}
