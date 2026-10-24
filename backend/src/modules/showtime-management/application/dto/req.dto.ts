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
import {
  DATE_PATTERN,
  MSG_INVALID_DATE,
  MSG_INVALID_TIME,
  TIME_PATTERN,
} from '../../domain/constants/showtime-management.constants';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class SearchManagedShowtimeReqDto extends PageRequest {
  /** Lọc 1 ngày theo giờ rạp (YYYY-MM-DD). */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: MSG_INVALID_DATE })
  date?: string;

  @IsOptional()
  @IsString()
  movieId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @Transform(toBoolean)
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
  @IsEnum(['SEAT', 'DAY'])
  group!: 'SEAT' | 'DAY';

  @IsString()
  fieldKey!: string;

  @IsString()
  @IsNotEmpty()
  ruleId!: string;
}

/** Dùng cho cả POST và PATCH (form đầy đủ). */
export class SaveShowtimeReqDto {
  @Transform(trimString)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  movieId!: string;

  @Transform(trimString)
  @IsDefined()
  @Matches(DATE_PATTERN, { message: MSG_INVALID_DATE })
  screeningDate!: string;

  @Transform(trimString)
  @IsDefined()
  @Matches(TIME_PATTERN, { message: MSG_INVALID_TIME })
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
