import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageRequest } from '../../../../common/dto/page.dto';
import { PriceGroup } from '../../../pricerule/domain/enums/price-group.enum';
import {
  DATE_REGEX,
  TIME_REGEX,
} from '../../domain/constants/showtime-management.constants';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SearchManagedShowtimeReqDto extends PageRequest {
  @IsOptional()
  @Matches(DATE_REGEX)
  date?: string;

  @IsOptional()
  @IsString()
  movieId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  includePast?: boolean;
}

export class MovieOptionSearchReqDto extends PageRequest {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}

export class PriceSelectionReqDto {
  @IsEnum(PriceGroup)
  group!: PriceGroup;

  @IsString()
  @IsNotEmpty()
  fieldKey!: string;

  @IsString()
  @IsNotEmpty()
  ruleId!: string;
}

// Dùng cho cả POST và PATCH (form đầy đủ)
export class SaveShowtimeReqDto {
  @Transform(trimString)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  movieId!: string;

  @Transform(trimString)
  @IsDefined()
  @IsString()
  @Matches(DATE_REGEX)
  screeningDate!: string;

  @Transform(trimString)
  @IsDefined()
  @IsString()
  @Matches(TIME_REGEX)
  startTime!: string;

  @Transform(trimString)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceSelectionReqDto)
  priceSelections?: PriceSelectionReqDto[];
}
