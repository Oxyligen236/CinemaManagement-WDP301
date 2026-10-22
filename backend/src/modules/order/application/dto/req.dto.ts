import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

import { PageRequest } from '../../../../common/dto/page.dto';
import { OrderStatus } from '../../domain/enums/order-status.enum';

export class QueryMyOrdersReq extends PageRequest {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class QueryStaffOrdersReq extends PageRequest {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  date?: string;
}

export class QueryAdminOrdersReq extends PageRequest {
  @IsOptional()
  userId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  fromDate?: string;

  @IsOptional()
  toDate?: string;
}
