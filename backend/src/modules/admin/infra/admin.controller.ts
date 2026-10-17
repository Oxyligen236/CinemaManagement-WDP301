import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminService } from '../application/admin.service';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import {
  AuthenticatedRequest,
  AuthUser,
} from '../../auth/domain/auth-user';
import { Role } from '../../user/domain/enums/role.enum';

@Controller('admin')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard(@Req() req: AuthenticatedRequest) {
    return this.adminService.getDashboard(req.user as AuthUser);
  }
}
