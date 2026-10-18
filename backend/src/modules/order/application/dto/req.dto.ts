import { IsEnum, IsOptional } from 'class-validator';
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
