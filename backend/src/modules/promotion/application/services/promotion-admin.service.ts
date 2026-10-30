import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CreatePromotionUsecase } from '../usecase/create-promotion.usecase';
import { UpdatePromotionUsecase } from '../usecase/update-promotion.usecase';
import { ChangePromotionStatusUsecase } from '../usecase/change-promotion-status.usecase';
import { QueryPromotionUsecase } from '../usecase/query-promotion.usecase';
import {
  Promotion,
  PromotionDocument,
} from '../../domain/schemas/promotion.schema';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  QueryPromotionsDto,
} from '../dto/req.dto';
import { PromotionResponseDto } from '../dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';
import { DiscountType } from '../../domain/enums/discount-type.enum';
import { PromotionCreatedEvent } from '../../domain/events/promotion-created.event';
import { PromotionUpdatedEvent } from '../../domain/events/promotion-updated.event';
import { PromotionStatusChangedEvent } from '../../domain/events/promotion-status-changed.event';

@Injectable()
export class PromotionAdminService
  implements
    CreatePromotionUsecase,
    UpdatePromotionUsecase,
    ChangePromotionStatusUsecase,
    QueryPromotionUsecase
{
  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
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

    const codeExists = await this.promotionModel
      .findOne({ promotionCode })
      .exec();
    if (codeExists) {
      throw new ConflictException(
        `Promotion code ${promotionCode} already exists`,
      );
    }

    const created = await this.promotionModel.create({
      promotionCode,
      discountValue: dto.discountValue,
      discountType: dto.discountType,
      startDate,
      endDate,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    const promotionId = created._id.toString();

    await this.eventBus.publish(
      new PromotionCreatedEvent(
        promotionId,
        created.promotionCode,
        created.discountType,
        created.discountValue,
        created.startDate,
        created.endDate,
        created.isActive,
      ),
    );

    return PromotionResponseDto.from({
      promotionId,
      promotionCode: created.promotionCode,
      discountValue: created.discountValue,
      discountType: created.discountType,
      startDate: created.startDate,
      endDate: created.endDate,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  }

  async getPromotions(
    query: QueryPromotionsDto,
  ): Promise<Page<PromotionResponseDto>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.search && query.search.trim() !== '') {
      const escaped = query.search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.promotionCode = { $regex: escaped, $options: 'i' };
    }
    if (query.discountType) {
      filter.discountType = query.discountType;
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.promotionModel
        .find(filter)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.promotionModel.countDocuments(filter).exec(),
    ]);

    return Page.from(
      items.map((p) =>
        PromotionResponseDto.from({
          promotionId: p._id.toString(),
          promotionCode: p.promotionCode,
          discountValue: p.discountValue,
          discountType: p.discountType,
          startDate: p.startDate,
          endDate: p.endDate,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }),
      ),
      total,
      page,
      limit,
    );
  }

  async getPromotionById(promotionId: string): Promise<PromotionResponseDto> {
    const promotion = isValidObjectId(promotionId)
      ? await this.promotionModel.findById(promotionId).exec()
      : null;
    if (!promotion) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }

    return PromotionResponseDto.from({
      promotionId: promotion._id.toString(),
      promotionCode: promotion.promotionCode,
      discountValue: promotion.discountValue,
      discountType: promotion.discountType,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      isActive: promotion.isActive,
      createdAt: promotion.createdAt,
      updatedAt: promotion.updatedAt,
    });
  }

  async updatePromotion(
    promotionId: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    if (!isValidObjectId(promotionId)) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }
    const existing = await this.promotionModel.findById(promotionId).exec();
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

    const newType = dto.discountType ?? existing.discountType;
    const newValue = dto.discountValue ?? existing.discountValue;

    if (newValue <= 0) {
      throw new BadRequestException('Discount value must be greater than 0');
    }

    if (newType === DiscountType.PERCENTAGE && newValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const updates: Partial<Promotion> = {};
    if (dto.discountValue !== undefined)
      updates.discountValue = dto.discountValue;
    if (dto.discountType !== undefined) updates.discountType = dto.discountType;
    if (dto.startDate !== undefined)
      updates.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updates.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;

    const updated = await this.promotionModel
      .findByIdAndUpdate(promotionId, { $set: updates }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }

    const updatedId = updated._id.toString();

    await this.eventBus.publish(
      new PromotionUpdatedEvent(updatedId, updated.promotionCode, dto),
    );

    return PromotionResponseDto.from({
      promotionId: updatedId,
      promotionCode: updated.promotionCode,
      discountValue: updated.discountValue,
      discountType: updated.discountType,
      startDate: updated.startDate,
      endDate: updated.endDate,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }

  async changePromotionStatus(
    promotionId: string,
    isActive: boolean,
  ): Promise<PromotionResponseDto> {
    if (!isValidObjectId(promotionId)) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }
    const updated = await this.promotionModel
      .findByIdAndUpdate(promotionId, { $set: { isActive } }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Promotion with id ${promotionId} not found`);
    }

    const updatedId = updated._id.toString();

    await this.eventBus.publish(
      new PromotionStatusChangedEvent(
        updatedId,
        updated.promotionCode,
        updated.isActive,
      ),
    );

    return PromotionResponseDto.from({
      promotionId: updatedId,
      promotionCode: updated.promotionCode,
      discountValue: updated.discountValue,
      discountType: updated.discountType,
      startDate: updated.startDate,
      endDate: updated.endDate,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }
}
