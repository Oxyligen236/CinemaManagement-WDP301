import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  DEFAULT_MULTIPLIER,
  MSG_INVALID_SELECTION,
  MSG_LOAD_FAILED,
  MULTIPLIER_MIN,
  PRICE_FIELDS,
} from '../../domain/constants/price-rule.constants';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { PriceSelectionInputDto } from '../dto/req.dto';
import {
  PriceFieldResDto,
  ResolvedDaySelectionResDto,
  ResolvedPriceSelectionsResDto,
  ResolvedSeatSelectionResDto,
} from '../dto/res.dto';
import {
  resolvePriceField,
  toPriceValueDto,
} from '../helpers/price-rule.helper';
import { ListPriceValuesUsecase } from '../usecase/list-price-values.usecase';
import { ResolvePriceSelectionsUsecase } from '../usecase/resolve-price-selections.usecase';

@Injectable()
export class PriceRuleOptionQueryService
  implements ListPriceValuesUsecase, ResolvePriceSelectionsUsecase
{
  private readonly logger = new Logger(PriceRuleOptionQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listPriceValues(): Promise<PriceFieldResDto[]> {
    try {
      return await Promise.all(
        PRICE_FIELDS.map((f) => this.readField(f.group, f.fieldKey)),
      );
    } catch (error) {
      this.logger.error('Failed to load price values', error);
      throw new InternalServerErrorException(MSG_LOAD_FAILED);
    }
  }

  async getPriceField(
    group: PriceGroup,
    fieldKey: string,
  ): Promise<PriceFieldResDto> {
    const field = resolvePriceField(group, fieldKey);
    try {
      return await this.readField(field.group, field.fieldKey);
    } catch (error) {
      this.logger.error('Failed to load price field', error);
      throw new InternalServerErrorException(MSG_LOAD_FAILED);
    }
  }

  async resolvePriceSelections(
    selections: PriceSelectionInputDto[],
  ): Promise<ResolvedPriceSelectionsResDto> {
    const seen = new Set<string>();
    for (const s of selections) {
      const known = PRICE_FIELDS.some(
        (f) => f.group === s.group && String(f.fieldKey) === s.fieldKey,
      );
      const id = `${s.group}:${s.fieldKey}`;
      if (!known || seen.has(id)) {
        throw new BadRequestException(MSG_INVALID_SELECTION);
      }
      seen.add(id);
    }

    const seatPriceSelections: ResolvedSeatSelectionResDto[] = [];
    const dayPriceSelections: ResolvedDaySelectionResDto[] = [];

    for (const field of PRICE_FIELDS) {
      const selected = selections.find(
        (s) => s.group === field.group && s.fieldKey === String(field.fieldKey),
      );
      let ruleId: string | null = null;
      let multiplier = DEFAULT_MULTIPLIER;

      if (selected) {
        let doc: { id: string; adjustmentValue: number } | null = null;
        try {
          if (field.group === PriceGroup.SEAT) {
            doc = await this.prisma.seatPriceRule.findFirst({
              where: {
                id: selected.ruleId,
                seatType: field.fieldKey as any,
                adjustmentValue: { gte: MULTIPLIER_MIN },
              },
            });
          } else {
            doc = await this.prisma.dayPriceRule.findFirst({
              where: {
                id: selected.ruleId,
                dayType: field.fieldKey as any,
                adjustmentValue: { gte: MULTIPLIER_MIN },
              },
            });
          }
        } catch (error) {
          this.logger.error('Failed to resolve price selection', error);
          throw new InternalServerErrorException(MSG_LOAD_FAILED);
        }
        if (!doc) throw new BadRequestException(MSG_INVALID_SELECTION);
        ruleId = doc.id;
        multiplier = doc.adjustmentValue;
      }

      if (field.group === PriceGroup.SEAT) {
        seatPriceSelections.push({
          seatType: field.fieldKey,
          ruleId,
          multiplier,
        });
      } else {
        dayPriceSelections.push({
          dayType: field.fieldKey,
          ruleId,
          multiplier,
        });
      }
    }

    return { seatPriceSelections, dayPriceSelections };
  }

  private async readField(
    group: PriceGroup,
    fieldKey: string,
  ): Promise<PriceFieldResDto> {
    const field = resolvePriceField(group, fieldKey);
    let docs: Array<{ id: string; adjustmentValue: number }> = [];

    if (group === PriceGroup.SEAT) {
      docs = await this.prisma.seatPriceRule.findMany({
        where: {
          seatType: fieldKey as any,
          adjustmentValue: { gte: MULTIPLIER_MIN },
        },
        orderBy: { adjustmentValue: 'asc' },
      });
    } else {
      docs = await this.prisma.dayPriceRule.findMany({
        where: {
          dayType: fieldKey as any,
          adjustmentValue: { gte: MULTIPLIER_MIN },
        },
        orderBy: { adjustmentValue: 'asc' },
      });
    }

    return {
      group: field.group,
      fieldKey: field.fieldKey,
      label: field.label,
      values: docs.map((d) =>
        toPriceValueDto({ ruleId: d.id, adjustmentValue: d.adjustmentValue }),
      ),
    };
  }
}
