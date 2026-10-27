import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PageRequest } from '../../../../common/dto/page.dto';
import { BranchStatus } from '../../domain/enums/branch-status.enum';

export class AdminBranchQueryDto extends PageRequest {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(BranchStatus)
  branchStatus?: BranchStatus;
}

export class CreateBranchDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Tên chi nhánh là bắt buộc.' })
  @MaxLength(200)
  branchName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ chi nhánh là bắt buộc.' })
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(30)
  hotline?: string;

  @IsOptional()
  @IsEnum(BranchStatus)
  branchStatus?: BranchStatus;
}

export class UpdateBranchDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Tên chi nhánh không được để trống.' })
  @MaxLength(200)
  branchName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ chi nhánh không được để trống.' })
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(30)
  hotline?: string;

  @IsOptional()
  @IsEnum(BranchStatus)
  branchStatus?: BranchStatus;
}

export class GetPublicBranchesReqDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  search?: string;
}
