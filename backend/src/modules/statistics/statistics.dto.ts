import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class FinancialStatisticsQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  date?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month';

  @IsOptional()
  @IsString()
  branchId?: string;
}
