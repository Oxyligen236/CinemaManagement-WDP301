import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  MAX_VALUES_PER_FIELD,
  MSG03,
  MSG_CREATE_SUCCESS,
  MSG_DELETE_SUCCESS,
  MSG_DUPLICATE_MULTIPLIER,
  MSG_MAX_VALUES,
  MSG_NOT_FOUND,
  MSG_SAVE_FAILED,
  MULTIPLIER_MIN,
} from '../../domain/constants/price-rule.constants';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { CreatePriceValueReqDto, UpdatePriceValueReqDto } from '../dto/req.dto';
import { PriceValueMutationResDto } from '../dto/res.dto';
import {
  buildMultiplierValidationException,
  normalizeMultiplier,
  validateMultiplier,
} from '../helpers/multiplier-validation.helper';
import {
  resolvePriceField,
  toPriceValueDto,
} from '../helpers/price-rule.helper';
import { toNumberOrKeep } from '../helpers/to-number-or-keep.helper';
import { CreatePriceValueUsecase } from '../usecase/create-price-value.usecase';
import { DeletePriceValueUsecase } from '../usecase/delete-price-value.usecase';
import { UpdatePriceValueUsecase } from '../usecase/update-price-value.usecase';
import { PriceRuleOptionQueryService } from './price-rule-option-query.service';

@Injectable()
export class PriceRuleValueService
  implements
    CreatePriceValueUsecase,
    UpdatePriceValueUsecase,
    DeletePriceValueUsecase
{
  private readonly logger = new Logger(PriceRuleValueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly optionQueryService: PriceRuleOptionQueryService,
  ) {}

  async createPriceValue(
    group: PriceGroup,
    fieldKey: string,
    dto: CreatePriceValueReqDto,
  ): Promise<PriceValueMutationResDto> {
    const field = resolvePriceField(group, fieldKey);
    const multiplier = this.validateAndNormalize(dto?.multiplier);

    try {
      if (group === PriceGroup.SEAT) {
        const count = await this.prisma.seatPriceRule.count({
          where: {
            seatType: field.fieldKey as any,
            adjustmentValue: { gte: MULTIPLIER_MIN },
          },
        });
        if (count >= MAX_VALUES_PER_FIELD) {
          throw new ConflictException(MSG_MAX_VALUES);
        }

        const duplicated = await this.prisma.seatPriceRule.findFirst({
          where: { seatType: field.fieldKey as any, adjustmentValue: multiplier },
        });
        if (duplicated) throw new ConflictException(MSG_DUPLICATE_MULTIPLIER);

        const created = await this.prisma.seatPriceRule.create({
          data: {
            seatType: field.fieldKey as any,
            adjustmentValue: multiplier,
          },
        });
        return {
          message: MSG_CREATE_SUCCESS,
          value: toPriceValueDto({ ruleId: created.id, adjustmentValue: created.adjustmentValue }),
          field: await this.optionQueryService.getPriceField(group, fieldKey),
        };
      } else {
        const count = await this.prisma.dayPriceRule.count({
          where: {
            dayType: field.fieldKey as any,
            adjustmentValue: { gte: MULTIPLIER_MIN },
          },
        });
        if (count >= MAX_VALUES_PER_FIELD) {
          throw new ConflictException(MSG_MAX_VALUES);
        }

        const duplicated = await this.prisma.dayPriceRule.findFirst({
          where: { dayType: field.fieldKey as any, adjustmentValue: multiplier },
        });
        if (duplicated) throw new ConflictException(MSG_DUPLICATE_MULTIPLIER);

        const created = await this.prisma.dayPriceRule.create({
          data: {
            dayType: field.fieldKey as any,
            adjustmentValue: multiplier,
          },
        });
        return {
          message: MSG_CREATE_SUCCESS,
          value: toPriceValueDto({ ruleId: created.id, adjustmentValue: created.adjustmentValue }),
          field: await this.optionQueryService.getPriceField(group, fieldKey),
        };
      }
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updatePriceValue(
    group: PriceGroup,
    fieldKey: string,
    ruleId: string,
    dto: UpdatePriceValueReqDto,
  ): Promise<PriceValueMutationResDto> {
    const field = resolvePriceField(group, fieldKey);
    const multiplier = this.validateAndNormalize(dto?.multiplier);

    try {
      if (group === PriceGroup.SEAT) {
        const current = await this.prisma.seatPriceRule.findFirst({
          where: { id: ruleId, seatType: field.fieldKey as any },
        });
        if (!current) throw new NotFoundException(MSG_NOT_FOUND);

        const duplicated = await this.prisma.seatPriceRule.findFirst({
          where: {
            seatType: field.fieldKey as any,
            adjustmentValue: multiplier,
            id: { not: ruleId },
          },
        });
        if (duplicated) throw new ConflictException(MSG_DUPLICATE_MULTIPLIER);

        const updated = await this.prisma.seatPriceRule.update({
          where: { id: ruleId },
          data: { adjustmentValue: multiplier },
        });

        return {
          message: MSG03,
          value: toPriceValueDto({ ruleId: updated.id, adjustmentValue: updated.adjustmentValue }),
          field: await this.optionQueryService.getPriceField(group, fieldKey),
        };
      } else {
        const current = await this.prisma.dayPriceRule.findFirst({
          where: { id: ruleId, dayType: field.fieldKey as any },
        });
        if (!current) throw new NotFoundException(MSG_NOT_FOUND);

        const duplicated = await this.prisma.dayPriceRule.findFirst({
          where: {
            dayType: field.fieldKey as any,
            adjustmentValue: multiplier,
            id: { not: ruleId },
          },
        });
        if (duplicated) throw new ConflictException(MSG_DUPLICATE_MULTIPLIER);

        const updated = await this.prisma.dayPriceRule.update({
          where: { id: ruleId },
          data: { adjustmentValue: multiplier },
        });

        return {
          message: MSG03,
          value: toPriceValueDto({ ruleId: updated.id, adjustmentValue: updated.adjustmentValue }),
          field: await this.optionQueryService.getPriceField(group, fieldKey),
        };
      }
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async deletePriceValue(
    group: PriceGroup,
    fieldKey: string,
    ruleId: string,
  ): Promise<PriceValueMutationResDto> {
    const field = resolvePriceField(group, fieldKey);

    try {
      if (group === PriceGroup.SEAT) {
        const current = await this.prisma.seatPriceRule.findFirst({
          where: { id: ruleId, seatType: field.fieldKey as any },
        });
        if (!current) throw new NotFoundException(MSG_NOT_FOUND);

        await this.prisma.seatPriceRule.delete({ where: { id: ruleId } });

        return {
          message: MSG_DELETE_SUCCESS,
          value: toPriceValueDto({ ruleId: current.id, adjustmentValue: current.adjustmentValue }),
          field: await this.optionQueryService.getPriceField(group, fieldKey),
        };
      } else {
        const current = await this.prisma.dayPriceRule.findFirst({
          where: { id: ruleId, dayType: field.fieldKey as any },
        });
        if (!current) throw new NotFoundException(MSG_NOT_FOUND);

        await this.prisma.dayPriceRule.delete({ where: { id: ruleId } });

        return {
          message: MSG_DELETE_SUCCESS,
          value: toPriceValueDto({ ruleId: current.id, adjustmentValue: current.adjustmentValue }),
          field: await this.optionQueryService.getPriceField(group, fieldKey),
        };
      }
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  private validateAndNormalize(raw: unknown): number {
    const numeric = toNumberOrKeep({ value: raw });
    const err = validateMultiplier(numeric);
    if (err) throw buildMultiplierValidationException([err]);
    return normalizeMultiplier(numeric as number);
  }

  private mapWriteError(error: unknown): Error {
    if (error instanceof HttpException) return error;
    this.logger.error('Database write error', error);
    return new InternalServerErrorException(MSG_SAVE_FAILED);
  }
}
