import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageRequest } from '../../../../common/dto/page.dto';

export class ScheduleSeatSelectionDto {
  @IsString()
  @IsNotEmpty()
  seatType!: string;

  @IsOptional()
  @IsString()
  ruleId!: string | null;

  @IsNumber()
  multiplier!: number;
}

export class ScheduleDaySelectionDto {
  @IsString()
  @IsNotEmpty()
  dayType!: string;

  @IsOptional()
  @IsString()
  ruleId!: string | null;

  @IsNumber()
  multiplier!: number;
}

// Dữ liệu đầu vào đã được module điều phối kiểm tra tham chiếu và tính endTime
export class ScheduleShowtimeInputDto {
  @IsString()
  @IsNotEmpty()
  movieId!: string;

  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsDate()
  startTime!: Date;

  @IsDate()
  endTime!: Date;

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSeatSelectionDto)
  seatPriceSelections!: ScheduleSeatSelectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDaySelectionDto)
  dayPriceSelections!: ScheduleDaySelectionDto[];
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
