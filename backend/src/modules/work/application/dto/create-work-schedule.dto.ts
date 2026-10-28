import {
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWorkScheduleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  shiftName!: string;

  @IsString()
  branchId!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
