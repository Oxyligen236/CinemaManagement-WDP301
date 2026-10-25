import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PageRequest } from '../../../../common/dto/page.dto';
import { OrderStatus } from '../../domain/enums/order-status.enum';
import { PaymentMethod } from '../../contracts/payment.contract';

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

export class PosProductItemReq {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePosOrderReq {
  @IsString()
  @IsNotEmpty()
  showtimeId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  seatShowtimeIds!: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosProductItemReq)
  products?: PosProductItemReq[];
}

export class ProcessPosCashPaymentReq {
  @IsNumber()
  @Min(0)
  cashReceived!: number;
}

export class InitiatePosQrPaymentReq {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}

export class CancelPosOrderReq {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
