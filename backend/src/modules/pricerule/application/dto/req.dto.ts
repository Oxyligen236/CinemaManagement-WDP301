import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  MSG_INVALID_FIELD,
  MSG_INVALID_MULTIPLIER,
  MSG_NOT_FOUND,
  MULTIPLIER_MAX,
  MULTIPLIER_MAX_DECIMALS,
  MULTIPLIER_MIN,
  msg02,
} from '../../domain/constants/price-rule.constants';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { toNumberOrKeep } from '../helpers/to-number-or-keep.helper';

/** Params `:group/:fieldKey`. */
export class PriceFieldParamDto {
  @IsEnum(PriceGroup, { message: MSG_INVALID_FIELD })
  group!: PriceGroup;

  @IsString({ message: MSG_INVALID_FIELD })
  fieldKey!: string; // đối chiếu PRICE_FIELDS ở service
}

/** Params `:group/:fieldKey/values/:ruleId`. */
export class PriceValueParamDto extends PriceFieldParamDto {
  @IsString({ message: MSG_NOT_FOUND })
  @IsNotEmpty({ message: MSG_NOT_FOUND })
  ruleId!: string;
}

export class CreatePriceValueReqDto {
  @Transform(toNumberOrKeep)
  @IsDefined({ message: msg02('Multiplier') })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: MULTIPLIER_MAX_DECIMALS,
    },
    { message: MSG_INVALID_MULTIPLIER },
  )
  @Min(MULTIPLIER_MIN, { message: MSG_INVALID_MULTIPLIER })
  @Max(MULTIPLIER_MAX, { message: MSG_INVALID_MULTIPLIER })
  multiplier!: number;
}

/** PATCH: multiplier bắt buộc, cùng quy tắc với tạo mới. */
export class UpdatePriceValueReqDto {
  @Transform(toNumberOrKeep)
  @IsDefined({ message: msg02('Multiplier') })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: MULTIPLIER_MAX_DECIMALS,
    },
    { message: MSG_INVALID_MULTIPLIER },
  )
  @Min(MULTIPLIER_MIN, { message: MSG_INVALID_MULTIPLIER })
  @Max(MULTIPLIER_MAX, { message: MSG_INVALID_MULTIPLIER })
  multiplier!: number;
}

/** Lựa chọn của Branch Manager, dùng bởi UC Manage Showtimes. */
export class PriceSelectionInputDto {
  @IsEnum(PriceGroup)
  group!: PriceGroup;

  @IsString()
  fieldKey!: string;

  @IsString()
  @IsNotEmpty()
  ruleId!: string;
}
