import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  Min,
  Matches,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PageRequest } from '../../../../common/dto/page.dto';
import { DiscountType } from '../../domain/enums/discount-type.enum';

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Promotion code must contain only uppercase letters, numbers, hyphens and underscores',
  })
  promotionCode!: string;

  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdatePromotionDto {
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  discountValue?: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ChangePromotionStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;
}

export class QueryPromotionsDto extends PageRequest {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['createdAt', 'startDate', 'endDate', 'promotionCode'])
  sortBy?: 'createdAt' | 'startDate' | 'endDate' | 'promotionCode' =
    'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
