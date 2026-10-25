import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEFAULT_MULTIPLIER,
  MSG_INVALID_SELECTION,
  MSG_LOAD_FAILED,
  MULTIPLIER_MIN,
  PRICE_FIELDS,
} from '../../domain/constants/price-rule.constants';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import {
  DayPriceRule,
  DayPriceRuleDocument,
} from '../../domain/schemas/day-price-rule.schema';
import {
  SeatPriceRule,
  SeatPriceRuleDocument,
} from '../../domain/schemas/seat-price-rule.schema';
import {
  PriceRuleKeyName,
  PriceRuleRecord,
} from '../../domain/types/price-rule-record.type';
import { PriceSelectionInputDto } from '../dto/req.dto';
import {
  PriceFieldResDto,
  ResolvedDaySelectionResDto,
  ResolvedPriceSelectionsResDto,
  ResolvedSeatSelectionResDto,
} from '../dto/res.dto';
import {
  keyNameOf,
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

  constructor(
    @InjectModel(SeatPriceRule.name)
    private readonly seatModel: Model<SeatPriceRuleDocument>,
    @InjectModel(DayPriceRule.name)
    private readonly dayModel: Model<DayPriceRuleDocument>,
  ) {}

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

  /**
   * Dùng nội bộ cho PriceRuleValueService để dựng field trả về.
   * @throws BadRequestException khi trường không hợp lệ; InternalServerErrorException khi lỗi DB
   */
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
        const { model, keyName } = this.modelAndKey(field.group);
        let doc: PriceRuleRecord | null;
        try {
          doc = await model
            .findOne({
              ruleId: selected.ruleId,
              [keyName]: field.fieldKey,
              adjustmentValue: { $gte: MULTIPLIER_MIN },
            })
            .lean()
            .exec();
        } catch (error) {
          this.logger.error('Failed to resolve price selection', error);
          throw new InternalServerErrorException(MSG_LOAD_FAILED);
        }
        if (!doc) throw new BadRequestException(MSG_INVALID_SELECTION);
        ruleId = doc.ruleId;
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
    const { model, keyName } = this.modelAndKey(group);
    const docs: PriceRuleRecord[] = await model
      .find({
        [keyName]: fieldKey,
        adjustmentValue: { $gte: MULTIPLIER_MIN },
      })
      .sort({ adjustmentValue: 1 })
      .lean()
      .exec();
    return {
      group: field.group,
      fieldKey: field.fieldKey,
      label: field.label,
      values: docs.map((d) => toPriceValueDto(d)),
    };
  }

  private modelAndKey(group: PriceGroup): {
    model: Model<PriceRuleRecord>;
    keyName: PriceRuleKeyName;
  } {
    const model = (group === PriceGroup.SEAT
      ? this.seatModel
      : this.dayModel) as unknown as Model<PriceRuleRecord>;
    return { model, keyName: keyNameOf(group) };
  }
}
