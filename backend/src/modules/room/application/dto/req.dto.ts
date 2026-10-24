import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageRequest } from '../../../../common/dto/page.dto';
import { RoomStatus } from '../../domain/enums/room-status.enum';
import { SeatStatus } from '../../domain/enums/seat-status.enum';
import { SeatType } from '../../domain/enums/seat-type.enum';

export class BranchRoomQueryDto extends PageRequest {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  roomStatus?: RoomStatus;
}

export class CreateBranchRoomDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  roomName!: string;

  /** Số hàng ghế (mặc định 6 hàng A-F) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(15)
  rowCount?: number;

  /** Số ghế mỗi hàng (mặc định 10 ghế 1-10) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(20)
  columnsPerRow?: number;
}

export class UpdateBranchRoomDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  roomName?: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  roomStatus?: RoomStatus;
}

export class UpdateRoomSeatsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  seatIds!: string[];

  @IsOptional()
  @IsEnum(SeatStatus)
  status?: SeatStatus;

  @IsOptional()
  @IsEnum(SeatType)
  seatType?: SeatType;
}
