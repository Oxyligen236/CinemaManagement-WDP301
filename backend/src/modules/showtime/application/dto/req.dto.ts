import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PageRequest } from '../../../../common/dto/page.dto';

export class BranchShowtimeQueryDto extends PageRequest {
  /** Lọc theo ngày chiếu định dạng YYYY-MM-DD */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(20)
  date?: string;

  /** Lọc theo bộ phim */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  movieId?: string;

  /** Lọc theo phòng chiếu thuộc chi nhánh */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  roomId?: string;

  /** Từ khóa tìm theo tên phim hoặc tên phòng */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateBranchShowtimeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  movieId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  /** Thời điểm bắt đầu chiếu (ISO 8601 string) */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @IsDateString()
  startTime!: string;

  /** Giá vé cơ bản (VNĐ), mặc định 75.000 nếu không truyền */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;
}

export class UpdateBranchShowtimeDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  movieId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;
}

export class SearchShowtimeReqDto extends PageRequest {
  @IsOptional()
  @IsString()
  movieId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  // Lọc các suất chiếu thuộc các phòng của chi nhánh này
  @IsOptional()
  @IsString()
  branchId?: string;

  // Lọc các suất có startTime nằm trong ngày này (UTC)
  @IsOptional()
  @IsDateString()
  date?: string;

  // Lọc các suất có startTime >= from
  @IsOptional()
  @IsDateString()
  from?: string;

  // Lọc các suất có startTime <= to
  @IsOptional()
  @IsDateString()
  to?: string;
}
