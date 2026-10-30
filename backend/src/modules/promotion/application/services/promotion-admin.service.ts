import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { Page } from '../../../../common/dto/page.dto';
import { DiscountType } from '@prisma/client';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { CreatePromotionDto, QueryPromotionsDto, UpdatePromotionDto } from '../dto/req.dto';
import { PromotionResponseDto } from '../dto/res.dto';
import { PromotionCreatedEvent } from '../../domain/events/promotion-created.event';
import { PromotionUpdatedEvent } from '../../domain/events/promotion-updated.event';
import { PromotionStatusChangedEvent } from '../../domain/events/promotion-status-changed.event';
import { CreatePromotionUsecase } from '../usecase/create-promotion.usecase';
import { UpdatePromotionUsecase } from '../usecase/update-promotion.usecase';
import { ChangePromotionStatusUsecase } from '../usecase/change-promotion-status.usecase';
import { QueryPromotionUsecase } from '../usecase/query-promotion.usecase';

@Injectable()
export class PromotionAdminService
  implements
    CreatePromotionUsecase,
    UpdatePromotionUsecase,
    ChangePromotionStatusUsecase,
    QueryPromotionUsecase
{
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INTERNAL_EVENT_BUS)
    private readonly eventBus: InternalEventBus,
  ) {}

  async createPromotion(
    dto: CreatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const promotionCode = dto.promotionCode.trim().toUpperCase();
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const now = new Date();

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (endDate < now) {
      throw new BadRequestException('End date cannot be in the past');
    }

    if (dto.discountValue <= 0) {
      throw new BadRequestException('Discount value must be greater than 0');
    }

    if (
      dto.discountType === DiscountType.PERCENTAGE &&
      dto.discountValue > 100
    ) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const codeExists = await this.prisma.promotion.findFirst({
      where: { promotionCode },
    });
    if (codeExists) {
      throw new ConflictException(
        `Promotion code ${promotionCode} already exists`,
      );
    }

    const created = await this.prisma.promotion.create({
      data: {
        promotionCode,
        discountValue: dto.discountValue,
        discountType: dto.discountType as any,
        startDate,
        endDate,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.eventBus.publish(
      new PromotionCreatedEvent(
        created.id,
        created.promotionCode,
        created.discountType as any,
        created.discountValue,
        created.startDate,
        created.endDate,
        created.isActive,
      ),
    );

    return PromotionResponseDto.of(
      created.id,
      created.promotionCode,
      created.discountValue,
      created.discountType as any,
      created.startDate,
      created.endDate,
      created.isActive,
      created.createdAt,
      created.updatedAt,
    );
  }

  async getPromotions(
    query: QueryPromotionsDto,
  ): Promise<Page<PromotionResponseDto>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search && query.search.trim() !== '') {
      where.promotionCode = { contains: query.search.trim(), mode: 'insensitive' };
    }
    if (query.discountType) {
      where.discountType = query.discountType;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: { [sortField]: sortDirection },
        skip,
        take: limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return Page.from(
      items.map((p) =>
        PromotionResponseDto.of(
          p.id,
          p.promotionCode,
          p.discountValue,
          p.discountType as any,
          p.startDate,
          p.endDate,
          p.isActive,
          p.createdAt,
          p.updatedAt,
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async getPromotionById(promotionId: string): Promise<PromotionResponseDto> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
    });
    if (!promotion) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }

    return PromotionResponseDto.of(
      promotion.id,
      promotion.promotionCode,
      promotion.discountValue,
      promotion.discountType as any,
      promotion.startDate,
      promotion.endDate,
      promotion.isActive,
      promotion.createdAt,
      promotion.updatedAt,
    );
  }

  async updatePromotion(
    promotionId: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const existing = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
    });
    if (!existing) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }

    const newStart = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const newEnd = dto.endDate ? new Date(dto.endDate) : existing.endDate;

    if (newStart >= newEnd) {
      throw new BadRequestException('Start date must be before end date');
    }

    const newType = (dto.discountType as DiscountType) ?? existing.discountType;
    const newValue = dto.discountValue ?? existing.discountValue;

    if (newValue <= 0) {
      throw new BadRequestException('Discount value must be greater than 0');
    }

    if (newType === DiscountType.PERCENTAGE && newValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const data: any = {};
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.discountType !== undefined) data.discountType = dto.discountType as any;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.promotion.update({
      where: { id: promotionId },
      data,
    });

    await this.eventBus.publish(
      new PromotionUpdatedEvent(
        updated.id,
        updated.promotionCode,
        dto,
      ),
    );

    return PromotionResponseDto.of(
      updated.id,
      updated.promotionCode,
      updated.discountValue,
      updated.discountType as any,
      updated.startDate,
      updated.endDate,
      updated.isActive,
      updated.createdAt,
      updated.updatedAt,
    );
  }

  async changePromotionStatus(
    promotionId: string,
    isActive: boolean,
  ): Promise<PromotionResponseDto> {
    const existing = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
    });
    if (!existing) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }

    const updated = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: { isActive },
    });

    await this.eventBus.publish(
      new PromotionStatusChangedEvent(
        updated.id,
        updated.promotionCode,
        updated.isActive,
      ),
    );

    return PromotionResponseDto.of(
      updated.id,
      updated.promotionCode,
      updated.discountValue,
      updated.discountType as any,
      updated.startDate,
      updated.endDate,
      updated.isActive,
      updated.createdAt,
      updated.updatedAt,
    );
  }
}
