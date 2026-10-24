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

interface RequestWithUser {
  user?: {
    userId?: string;
    sub?: string;
    role?: string;
    email?: string;
  };
}

@Controller('tickets')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('scan')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(Role.STAFF)
  async scanTicket(
    @Body() dto: ScanTicketReq,
    @Req() req: RequestWithUser,
  ): Promise<ScanTicketResultRes> {
    const staffId = req.user?.userId || req.user?.sub || 'staff-default';
    return this.ticketService.scanTicket(dto, staffId);
  }

  @Get(':ticketCode')
  @UseGuards(JwtGuard)
  async getTicketDetail(
    @Param('ticketCode') ticketCode: string,
  ): Promise<TicketDetailRes> {
    return this.ticketService.getTicketDetail(ticketCode);
  }
}
