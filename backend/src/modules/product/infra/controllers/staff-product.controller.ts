import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Role, Roles } from '../../../auth/infra/decorators/role.decorator';
import { AuthenticatedRequest, AuthUser } from '../../../auth/domain/auth-user';
import { ProductService } from '../../application/services/product.service';
import { BranchConcessionCatalogRes } from '../../application/dto/res.dto';

@Controller('staff/products')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.STAFF)
export class StaffProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getStaffConcessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<BranchConcessionCatalogRes> {
    const authUser = req.user as AuthUser;
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { branchId: true, isActive: true },
    });

    if (!user || !user.branchId || !user.isActive) {
      throw new ForbiddenException(
        'Tài khoản nhân viên chưa được gán chi nhánh hoạt động',
      );
    }

    return this.productService.getBranchConcessions(user.branchId);
  }
}
