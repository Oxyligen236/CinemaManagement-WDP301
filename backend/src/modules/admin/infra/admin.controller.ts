/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminService } from '../application/admin.service';
import {
  ManageUsersQueryDto,
  UpdateUserDto,
} from '../application/dto/manage-user.dto';
import { JwtGuard } from '../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../auth/infra/guards/role.guard';
import { Roles } from '../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../auth/domain/auth-user';
import { Role } from '../../user/domain/enums/role.enum';

@Controller('admin')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard(@Req() req: AuthenticatedRequest) {
    return this.adminService.getDashboard(req.user as AuthUser);
  }

  @Get('users')
  getUsers(@Query() query: ManageUsersQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:userId')
  getUser(@Param('userId') userId: string) {
    return this.adminService.getUser(userId);
  }

  @Patch('users/:userId')
  updateUser(
    @Param('userId') userId: string,
    @Body() input: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.updateUser(
      userId,
      input,
      (req.user as AuthUser).sub,
    );
  }
}
