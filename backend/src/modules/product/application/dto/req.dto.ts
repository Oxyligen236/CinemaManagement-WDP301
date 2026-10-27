import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PageRequest } from '../../../../common/dto/page.dto';
import { ItemCategory } from '../../domain/enums/item-category.enum';
import { ItemStatus } from '../../domain/enums/item-status.enum';
import { ItemSize } from '../../domain/enums/item-size.enum';
import { ComboStatus } from '../../domain/enums/combo-status.enum';
import { StockAdjustmentType } from '../../domain/enums/stock-adjustment-type.enum';
import { ExcelStockMode } from '../../domain/enums/excel-stock-mode.enum';

// --- Item Reqs ---
export class QueryBranchItemsReq extends PageRequest {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ItemCategory)
  category?: ItemCategory;

  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;

  @IsOptional()
  @Type(() => Boolean)
  lowStockOnly?: boolean;
}

export class CreateItemReq {
  @IsNotEmpty({ message: 'Tên món không được để trống' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  @Transform(({ value }: { value: unknown }) =>
    value === 'DRINK' ? ItemCategory.BEVERAGE : value,
  )
  @IsEnum(ItemCategory)
  category!: ItemCategory;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (!value || value === 'NONE' || value === '') return undefined;
    if (value === 'S') return ItemSize.STANDARD;
    if (value === 'M') return ItemSize.MEDIUM;
    if (value === 'L') return ItemSize.LARGE;
    return value;
  })
  @IsEnum(ItemSize)
  size?: ItemSize;

  @IsNumber({}, { message: 'Giá bán phải là số' })
  @Min(0, { message: 'Giá bán không được nhỏ hơn 0' })
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lowStockThreshold?: number = 10;

  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus = ItemStatus.AVAILABLE;

  @IsOptional()
  @IsString()
  imageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateItemReq {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'DRINK' ? ItemCategory.BEVERAGE : value,
  )
  @IsEnum(ItemCategory)
  category?: ItemCategory;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (!value || value === 'NONE' || value === '') return undefined;
    if (value === 'S') return ItemSize.STANDARD;
    if (value === 'M') return ItemSize.MEDIUM;
    if (value === 'L') return ItemSize.LARGE;
    return value;
  })
  @IsEnum(ItemSize)
  size?: ItemSize;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lowStockThreshold?: number;

  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;

  @IsOptional()
  @IsString()
  imageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class AdjustItemStockReq {
  @IsNotEmpty({ message: 'Loại điều chỉnh kho không được để trống' })
  @IsEnum(StockAdjustmentType)
  adjustmentType!: StockAdjustmentType;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ChangeItemStatusReq {
  @IsNotEmpty()
  @IsEnum(ItemStatus)
  status!: ItemStatus;
}

export class ImportItemsExcelReq {
  @IsOptional()
  @IsEnum(ExcelStockMode)
  stockMode?: ExcelStockMode = ExcelStockMode.OVERWRITE;
}

// --- Combo Reqs ---
export class ComboItemInputReq {
  @IsNotEmpty({ message: 'itemId không được để trống' })
  @IsString()
  itemId!: string;

  @IsInt({ message: 'Số lượng món phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Type(() => Number)
  quantity!: number;
}

export class QueryBranchCombosReq extends PageRequest {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ComboStatus)
  status?: ComboStatus;
}

export class CreateComboReq {
  @IsNotEmpty({ message: 'Tên combo không được để trống' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsEnum(ComboStatus)
  status?: ComboStatus = ComboStatus.AVAILABLE;

  @IsOptional()
  @IsString()
  imageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray({ message: 'Danh sách món thành phần phải là mảng' })
  @ArrayMinSize(1, { message: 'Combo phải có ít nhất 1 món thành phần' })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
    return value;
  })
  @ValidateNested({ each: true })
  @Type(() => ComboItemInputReq)
  items!: ComboItemInputReq[];
}

export class UpdateComboReq {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsEnum(ComboStatus)
  status?: ComboStatus;

  @IsOptional()
  @IsString()
  imageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
    return value;
  })
  @ValidateNested({ each: true })
  @Type(() => ComboItemInputReq)
  items?: ComboItemInputReq[];
}

export class ChangeComboStatusReq {
  @IsNotEmpty()
  @IsEnum(ComboStatus)
  status!: ComboStatus;
}
