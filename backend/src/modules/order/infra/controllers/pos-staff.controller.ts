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
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles } from '../../../auth/infra/decorators/role.decorator';
import { Role } from '../../../user/domain/enums/role.enum';
import { AuthenticatedRequest, AuthUser } from '../../../auth/domain/auth-user';
import { User, UserDocument } from '../../../user/domain/schemas/user.schema';
import { PosOrderService } from '../../application/services/pos-order.service';
import {
  ApplyPromotionReq,
  CancelPosOrderReq,
  CreatePosOrderReq,
  InitiatePosQrPaymentReq,
  ProcessPosCashPaymentReq,
} from '../../application/dto/req.dto';
import {
  PosBookingSummaryRes,
  PosCashPaymentResultRes,
  PosQrPaymentRes,
  PosReceiptRes,
} from '../../application/dto/res.dto';

@Controller('staff/pos/orders')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PosStaffController {
  constructor(
    private readonly posOrderService: PosOrderService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private async getStaffContext(
    req: AuthenticatedRequest,
  ): Promise<{ staffId: string; branchId: string; staffName: string }> {
    const authUser = req.user as AuthUser;
    const user = await this.userModel
      .findById(
        Types.ObjectId.isValid(authUser.sub)
          ? new Types.ObjectId(authUser.sub)
          : authUser.sub,
      )
      .select('branchId firstName lastName isActive')
      .lean()
      .exec();

    if (!user || !user.branchId) {
      throw new ForbiddenException(
        'Tài khoản nhân viên chưa được gán chi nhánh hoạt động',
      );
    }

    const staffName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Thu ngân';

    return {
      staffId: authUser.sub,
      branchId: user.branchId.toString(),
      staffName,
    };
  }

  @Post()
  async createPosBookingOrder(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreatePosOrderReq,
  ): Promise<PosBookingSummaryRes> {
    const staffContext = await this.getStaffContext(req);
    return this.posOrderService.createPosBookingOrder(staffContext, body);
  }

  @Post(':orderId/apply-promotion')
  async applyPromotion(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: ApplyPromotionReq,
  ): Promise<PosBookingSummaryRes> {
    const staffContext = await this.getStaffContext(req);
    return this.posOrderService.applyPosPromotion(staffContext, orderId, body);
  }

  @Post(':orderId/cancel')
  async cancelPosOrder(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body?: CancelPosOrderReq,
  ): Promise<{ success: boolean; message: string }> {
    const staffContext = await this.getStaffContext(req);
    return this.posOrderService.cancelPosOrder(staffContext, orderId, body);
  }

  @Post(':orderId/pay/cash')
  async confirmPosCashPayment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: ProcessPosCashPaymentReq,
  ): Promise<PosCashPaymentResultRes> {
    const staffContext = await this.getStaffContext(req);
    return this.posOrderService.confirmPosCashPayment(
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
    return this.posOrderService.initiatePosQrPayment(
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
    return this.posOrderService.checkPosPaymentStatus(staffContext, orderId);
  }

  @Get(':orderId/receipt')
  async getPosReceipt(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ): Promise<PosReceiptRes> {
    const staffContext = await this.getStaffContext(req);
    return this.posOrderService.getPosReceipt(staffContext, orderId);
  }
}
