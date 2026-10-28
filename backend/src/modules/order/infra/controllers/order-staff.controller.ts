import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles, Role } from '../../../auth/infra/decorators/role.decorator';
import { OrderService } from '../../application/services/order.service';
import { UserBranchQueryService } from '../../../user/application/services/user-branch-query.service';
import {
  CancelOrderReq,
  QueryStaffOrdersReq,
} from '../../application/dto/req.dto';
import { CancelOrderRes, OrderSummaryRes } from '../../application/dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';

interface AuthenticatedRequest {
  user?: {
    userId?: string;
    sub?: string;
  };
}

@Controller('staff/orders')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrderStaffController {
  constructor(
    private readonly orderService: OrderService,
    private readonly userBranchQueryService: UserBranchQueryService,
  ) {}

  @Get()
  async getStaffOrders(
    @Query() query: QueryStaffOrdersReq,
  ): Promise<Page<OrderSummaryRes>> {
    return this.orderService.queryStaffOrders(query);
  }

  @Post(':orderId/cancel')
  async cancelStaffOrder(
    @Param('orderId') orderId: string,
    @Body() body: CancelOrderReq,
    @Req() req: AuthenticatedRequest,
  ): Promise<CancelOrderRes> {
    const staffId = req.user?.userId || req.user?.sub;
    if (!staffId) {
      throw new UnauthorizedException(
        'Staff ID is missing from authorization context',
      );
    }
    const branchId =
      await this.userBranchQueryService.getBranchIdOfUser(staffId);
    return this.orderService.cancelOrder(
      orderId,
      { userId: staffId, role: Role.STAFF, branchId: branchId || undefined },
      body?.reason,
    );
  }
}
