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

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BranchShowtimeQueryDto {
  /** Lọc theo ngày chiếu định dạng YYYY-MM-DD */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  date?: string;

  /** Lọc theo bộ phim */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  movieId?: string;

  /** Lọc theo phòng chiếu thuộc chi nhánh */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  roomId?: string;

  /** Từ khóa tìm theo tên phim hoặc tên phòng */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateBranchShowtimeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  movieId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  /** Thời điểm bắt đầu chiếu (ISO 8601 string) */
  @Transform(trim)
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
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  movieId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @IsOptional()
  @Transform(trim)
  @IsNotEmpty()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;
}
