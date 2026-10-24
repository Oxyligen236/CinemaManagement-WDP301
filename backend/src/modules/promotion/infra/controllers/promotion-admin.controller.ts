import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PromotionAdminService } from '../../application/services/promotion-admin.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ChangePromotionStatusDto,
  QueryPromotionsDto,
} from '../../application/dto/req.dto';
import { PromotionResponseDto } from '../../application/dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { Roles, Role } from '../../../auth/infra/decorators/role.decorator';

@Controller('admin/promotions')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PromotionAdminController {
  constructor(private readonly promotionAdminService: PromotionAdminService) {}

  @Post()
  async createPromotion(
    @Body() dto: CreatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return this.promotionAdminService.createPromotion(dto);
  }

  @Get()
  async getPromotions(
    @Query() query: QueryPromotionsDto,
  ): Promise<Page<PromotionResponseDto>> {
    return this.promotionAdminService.getPromotions(query);
  }

  @Get(':id')
  async getPromotionById(
    @Param('id') id: string,
  ): Promise<PromotionResponseDto> {
    return this.promotionAdminService.getPromotionById(id);
  }

  @Put(':id')
  async updatePromotion(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return this.promotionAdminService.updatePromotion(id, dto);
  }

  @Patch(':id/status')
  async changePromotionStatus(
    @Param('id') id: string,
    @Body() dto: ChangePromotionStatusDto,
  ): Promise<PromotionResponseDto> {
    return this.promotionAdminService.changePromotionStatus(id, dto.isActive);
  }
}
