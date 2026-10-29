import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class FinancialStatisticsQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  date?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
