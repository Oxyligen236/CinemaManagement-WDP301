import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../../auth/infra/decorators/role.decorator';

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

export type StaffScanContext = StaffScanContextReq;

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
