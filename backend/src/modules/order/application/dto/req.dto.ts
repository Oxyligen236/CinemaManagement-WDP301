import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PageRequest } from '../../../../common/dto/page.dto';
import { Role } from '../../../auth/infra/decorators/role.decorator';

export class BookingProductReq {
  @IsString() @IsNotEmpty() productId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateBookingOrderReq {
  @IsString() @IsNotEmpty() showtimeId!: string;
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  seatShowtimeIds!: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingProductReq)
  products?: BookingProductReq[];
  @IsOptional() @IsString() promotionCode?: string;
}

export class ApplyPromotionReq {
  @IsString()
  @IsNotEmpty({ message: 'Mã khuyến mãi không được để trống' })
  promotionCode!: string;
}

export class QueryMyOrdersReq extends PageRequest {
  @IsOptional()
  @IsString()
  @Matches(
    /^(PENDING|PAID|CANCELLED|EXPIRED)(,(PENDING|PAID|CANCELLED|EXPIRED))*$/,
    {
      message:
        'status phải là một hoặc nhiều OrderStatus hợp lệ phân tách bằng dấu phẩy (PENDING, PAID, CANCELLED, EXPIRED)',
    },
  )
  status?: string;
}

export class QueryStaffOrdersReq extends PageRequest {
  @IsOptional()
  @IsString()
  @Matches(
    /^(PENDING|PAID|CANCELLED|EXPIRED)(,(PENDING|PAID|CANCELLED|EXPIRED))*$/,
    {
      message:
        'status phải là một hoặc nhiều OrderStatus hợp lệ phân tách bằng dấu phẩy (PENDING, PAID, CANCELLED, EXPIRED)',
    },
  )
  status?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

export class QueryAdminOrdersReq extends PageRequest {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @Matches(
    /^(PENDING|PAID|CANCELLED|EXPIRED)(,(PENDING|PAID|CANCELLED|EXPIRED))*$/,
    {
      message:
        'status phải là một hoặc nhiều OrderStatus hợp lệ phân tách bằng dấu phẩy (PENDING, PAID, CANCELLED, EXPIRED)',
    },
  )
  status?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class PosProductItemReq {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePosOrderReq {
  @IsOptional()
  @IsString()
  showtimeId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  seatShowtimeIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosProductItemReq)
  products?: PosProductItemReq[];
}

export class CancelPosOrderReq {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CancelOrderReq {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class StaffScanContextReq {
  @IsString()
  @IsNotEmpty()
  staffId!: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsEnum(Role)
  role!: Role;
}

export class ScanTicketReq {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  ticketCode!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value?: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  showtimeId?: string;
}
