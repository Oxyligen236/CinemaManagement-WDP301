import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles } from '../../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../../auth/domain/auth-user';
import { Role } from '../../../user/domain/enums/role.enum';
import { User, UserDocument } from '../../../user/domain/schemas/user.schema';
import { ProductService } from '../../application/services/product.service';
import { BranchConcessionCatalogRes } from '../../application/dto/res.dto';

@Controller('staff/products')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
export class StaffProductController {
  constructor(
    private readonly productService: ProductService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  @Get()
  async getStaffConcessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<BranchConcessionCatalogRes> {
    const authUser = req.user as AuthUser;
    const user = await this.userModel
      .findById(
        Types.ObjectId.isValid(authUser.sub)
          ? new Types.ObjectId(authUser.sub)
          : authUser.sub,
      )
      .select('branchId isActive')
      .lean()
      .exec();

    if (!user || !user.branchId) {
      throw new ForbiddenException(
        'Tài khoản nhân viên chưa được gán chi nhánh hoạt động',
      );
    }

    return this.productService.getBranchConcessions(user.branchId.toString());
  }
}
