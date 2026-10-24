import { DayType } from '../../domain/enums/day-type.enum';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { SeatType } from '../../domain/enums/seat-type.enum';

export class PriceValueResDto {
  ruleId!: string;
  multiplier!: number;
  updatedAt!: Date;
}

export class PriceFieldResDto {
  group!: PriceGroup;
  fieldKey!: string;
  label!: string;
  values!: PriceValueResDto[];
}

export class PriceValueMutationResDto {
  message!: string;
  value!: PriceValueResDto;
  field!: PriceFieldResDto;
}

export class ResolvedSeatSelectionResDto {
  seatType!: SeatType;
  ruleId!: string | null;
  multiplier!: number;
}

export class ResolvedDaySelectionResDto {
  dayType!: DayType;
  ruleId!: string | null;
  multiplier!: number;
}

export class ResolvedPriceSelectionsResDto {
  seatPriceSelections!: ResolvedSeatSelectionResDto[];
  dayPriceSelections!: ResolvedDaySelectionResDto[];
}
