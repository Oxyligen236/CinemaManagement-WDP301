import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Role, Roles } from '../../../auth/infra/decorators/role.decorator';
import { TicketService } from '../../application/services/ticket.service';
import { ScanTicketReq } from '../../application/dto/req.dto';
import {
  ScanTicketResultRes,
  TicketDetailRes,
} from '../../application/dto/res.dto';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';

interface RequestWithUser {
  user?: {
    userId?: string;
    sub?: string;
    role?: Role | string;
    email?: string;
  };
}

@Controller('tickets')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly userBranchQueryService: UserBranchQueryService,
  ) {}

  @Post('scan')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(Role.STAFF, Role.ADMIN)
  async scanTicket(
    @Body() dto: ScanTicketReq,
    @Req() req: RequestWithUser,
  ): Promise<ScanTicketResultRes> {
    const staffId = req.user?.userId || req.user?.sub || 'staff-default';
    const role = (req.user?.role as Role) || Role.STAFF;
    let branchId: string | undefined;

    if (role === Role.STAFF) {
      const queriedBranchId =
        await this.userBranchQueryService.getBranchIdOfUser(staffId);
      branchId = queriedBranchId ?? undefined;
    }

    return this.ticketService.scanTicket(dto, {
      staffId,
      branchId,
      role,
    });
  }

  @Get(':ticketCode')
  @UseGuards(JwtGuard)
  async getTicketDetail(
    @Param('ticketCode') ticketCode: string,
  ): Promise<TicketDetailRes> {
    return this.ticketService.getTicketDetail(ticketCode);
  }
}
