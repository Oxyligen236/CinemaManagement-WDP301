import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PageRequest } from '../../../../common/dto/page.dto';

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
