import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
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
import { CreatePriceValueReqDto, UpdatePriceValueReqDto } from '../dto/req.dto';
import { PriceValueMutationResDto } from '../dto/res.dto';
import {
  buildMultiplierValidationException,
  normalizeMultiplier,
  validateMultiplier,
} from '../helpers/multiplier-validation.helper';
import {
  keyNameOf,
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
    @InjectModel(SeatPriceRule.name)
    private readonly seatModel: Model<SeatPriceRuleDocument>,
    @InjectModel(DayPriceRule.name)
    private readonly dayModel: Model<DayPriceRuleDocument>,
    private readonly optionQueryService: PriceRuleOptionQueryService,
  ) {}

  async createPriceValue(
    group: PriceGroup,
    fieldKey: string,
    dto: CreatePriceValueReqDto,
  ): Promise<PriceValueMutationResDto> {
    const field = resolvePriceField(group, fieldKey);
    const multiplier = this.validateAndNormalize(dto?.multiplier);
    const { model, keyName } = this.modelAndKey(group);

    try {
      const count = await model
        .countDocuments({
          [keyName]: field.fieldKey,
          adjustmentValue: { $gte: MULTIPLIER_MIN },
        })
        .exec();
      if (count >= MAX_VALUES_PER_FIELD) {
        throw new ConflictException(MSG_MAX_VALUES);
      }

      const duplicated = await model
        .exists({ [keyName]: field.fieldKey, adjustmentValue: multiplier })
        .exec();
      if (duplicated) throw new ConflictException(MSG_DUPLICATE_MULTIPLIER);

      const created = await model.create({
        [keyName]: field.fieldKey,
        adjustmentValue: multiplier,
      });
      return {
        message: MSG_CREATE_SUCCESS,
        value: toPriceValueDto(created),
        field: await this.optionQueryService.getPriceField(group, fieldKey),
      };
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
    const { model, keyName } = this.modelAndKey(group);

    try {
      const idQuery = isValidObjectId(ruleId) ? { _id: ruleId } : { _id: null };
      const current = await model
        .findOne({ ...idQuery, [keyName]: field.fieldKey })
        .lean()
        .exec();
      if (!current) throw new NotFoundException(MSG_NOT_FOUND);

      const duplicated = await model
        .exists({
          [keyName]: field.fieldKey,
          adjustmentValue: multiplier,
          _id: { $ne: new Types.ObjectId(String(current._id)) },
        })
        .exec();
      if (duplicated) throw new ConflictException(MSG_DUPLICATE_MULTIPLIER);

      const updated = await model
        .findOneAndUpdate(
          { _id: current._id, [keyName]: field.fieldKey },
          { $set: { adjustmentValue: multiplier } },
          { new: true },
        )
        .lean()
        .exec();
      if (!updated) throw new NotFoundException(MSG_NOT_FOUND);

      return {
        message: MSG03,
        value: toPriceValueDto(updated),
        field: await this.optionQueryService.getPriceField(group, fieldKey),
      };
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
    const { model, keyName } = this.modelAndKey(group);

    try {
      const idQuery = isValidObjectId(ruleId) ? { _id: ruleId } : { _id: null };
      const current = await model
        .findOne({ ...idQuery, [keyName]: field.fieldKey })
        .lean()
        .exec();
      if (!current) throw new NotFoundException(MSG_NOT_FOUND);

      const result = await model.findByIdAndDelete(current._id).exec();
      if (!result) {
        throw new NotFoundException(MSG_NOT_FOUND);
      }

      return {
        message: MSG_DELETE_SUCCESS,
        value: toPriceValueDto(current),
        field: await this.optionQueryService.getPriceField(group, fieldKey),
      };
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /** Phòng thủ lần 2: validate multiplier khi service được gọi ngoài controller. */
  private validateAndNormalize(raw: unknown): number {
    const error = validateMultiplier(raw);
    if (error) throw buildMultiplierValidationException([error]);
    return normalizeMultiplier(toNumberOrKeep({ value: raw }) as number);
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

  private mapWriteError(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    this.logger.error('Failed to save price value', error);
    return new InternalServerErrorException(MSG_SAVE_FAILED);
  }
}
