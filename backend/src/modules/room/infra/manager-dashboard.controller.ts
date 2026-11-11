import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../../auth/domain/auth-user';
import { BranchRoomService } from '../application/branch-room.service';

@Controller('manager/dashboard')
export class ManagerDashboardController {
  constructor(
    private readonly branchRoomService: BranchRoomService,
    private readonly jwtService: JwtService,
  ) {}

  private extractUserId(req: Request): string | undefined {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) return undefined;
    try {
      const payload = this.jwtService.verify<AuthUser>(token);
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  @Get('overview')
  getDashboardOverview(@Req() req: Request) {
    return this.branchRoomService.getManagerDashboardOverview(
      this.extractUserId(req),
    );
  }

  @Get()
  getDashboard(@Req() req: Request) {
    return this.branchRoomService.getManagerDashboardOverview(
      this.extractUserId(req),
    );
  }
}
