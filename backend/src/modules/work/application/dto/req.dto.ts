import {
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsArray,
  ArrayUnique,
  IsMongoId,
} from 'class-validator';

export class CreateWorkScheduleReq {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  shiftName!: string;

  @IsMongoId()
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

export class AssignWorkScheduleReq {
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  userIds!: string[];
}

export class AssignDayReq {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsMongoId()
  userId!: string;
}

export class CloseDayShiftReq {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}

// Giữ alias tương thích ngược nếu cần
export { CreateWorkScheduleReq as CreateWorkScheduleDto };
export { AssignWorkScheduleReq as AssignWorkScheduleDto };
