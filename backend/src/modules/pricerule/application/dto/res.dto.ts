import { DayType } from '../../domain/enums/day-type.enum';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { SeatType } from '../../domain/enums/seat-type.enum';

export class PriceValueResDto {
  ruleId!: string;
  multiplier!: number;
  updatedAt!: Date;

  static of(
    ruleId: string,
    multiplier: number,
    updatedAt: Date,
  ): PriceValueResDto {
    const res = new PriceValueResDto();
    Object.assign(res, { ruleId, multiplier, updatedAt });
    return res;
  }
}

export class PriceFieldResDto {
  group!: PriceGroup;
  fieldKey!: string;
  label!: string;
  values!: PriceValueResDto[];

  static of(
    group: PriceGroup,
    fieldKey: string,
    label: string,
    values: PriceValueResDto[],
  ): PriceFieldResDto {
    const res = new PriceFieldResDto();
    Object.assign(res, { group, fieldKey, label, values });
    return res;
  }
}

export class PriceValueMutationResDto {
  message!: string;
  value!: PriceValueResDto;
  field!: PriceFieldResDto;

  static of(
    message: string,
    value: PriceValueResDto,
    field: PriceFieldResDto,
  ): PriceValueMutationResDto {
    const res = new PriceValueMutationResDto();
    Object.assign(res, { message, value, field });
    return res;
  }
}

export class ResolvedSeatSelectionResDto {
  seatType!: SeatType;
  ruleId!: string | null;
  multiplier!: number;

  static of(
    seatType: SeatType,
    ruleId: string | null,
    multiplier: number,
  ): ResolvedSeatSelectionResDto {
    const res = new ResolvedSeatSelectionResDto();
    Object.assign(res, { seatType, ruleId, multiplier });
    return res;
  }
}

export class ResolvedDaySelectionResDto {
  dayType!: DayType;
  ruleId!: string | null;
  multiplier!: number;

  static of(
    dayType: DayType,
    ruleId: string | null,
    multiplier: number,
  ): ResolvedDaySelectionResDto {
    const res = new ResolvedDaySelectionResDto();
    Object.assign(res, { dayType, ruleId, multiplier });
    return res;
  }
}

export class ResolvedPriceSelectionsResDto {
  seatPriceSelections!: ResolvedSeatSelectionResDto[];
  dayPriceSelections!: ResolvedDaySelectionResDto[];

  static of(
    seatPriceSelections: ResolvedSeatSelectionResDto[],
    dayPriceSelections: ResolvedDaySelectionResDto[],
  ): ResolvedPriceSelectionsResDto {
    const res = new ResolvedPriceSelectionsResDto();
    Object.assign(res, { seatPriceSelections, dayPriceSelections });
    return res;
  }
}
