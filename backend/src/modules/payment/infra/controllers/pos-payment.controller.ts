import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Role, Roles } from '../../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../../auth/domain/auth-user';
import { PaymentService } from '../../application/services/payment.service';
import {
  InitiatePosQrPaymentReq,
  ProcessPosCashPaymentReq,
} from '../../application/dto/req.dto';
import {
  PosCashPaymentResultRes,
  PosQrPaymentRes,
} from '../../application/dto/res.dto';

@Controller('staff/pos/orders')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PosPaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  private async getStaffContext(
    req: AuthenticatedRequest,
  ): Promise<{ staffId: string; branchId: string; staffName: string }> {
    const authUser = req.user as AuthUser;
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: {
        branchId: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user || !user.branchId || !user.isActive) {
      throw new ForbiddenException(
        'Tài khoản nhân viên chưa được gán chi nhánh hoạt động',
      );
    }

    const staffName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Thu ngân';

    return {
      staffId: authUser.sub,
      branchId: user.branchId,
      staffName,
    };
  }

  @Post(':orderId/pay/cash')
  async confirmPosCashPayment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: ProcessPosCashPaymentReq,
  ): Promise<PosCashPaymentResultRes> {
    const staffContext = await this.getStaffContext(req);
    return this.paymentService.confirmPosCashPayment(
      staffContext,
      orderId,
      body,
    );
  }

  @Post(':orderId/pay/qr')
  async initiatePosQrPayment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: InitiatePosQrPaymentReq,
  ): Promise<PosQrPaymentRes> {
    const staffContext = await this.getStaffContext(req);
    return this.paymentService.initiatePosQrPayment(
      staffContext,
      orderId,
      body,
    );
  }

  @Get(':orderId/pay/status')
  async checkPosPaymentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ): Promise<PosCashPaymentResultRes | PosQrPaymentRes> {
    const staffContext = await this.getStaffContext(req);
    return this.paymentService.checkPosPaymentStatus(staffContext, orderId);
  }
}
