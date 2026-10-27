import { BadRequestException } from '@nestjs/common';
import {
  MSG_INVALID_FIELD,
  PRICE_FIELDS,
} from '../../domain/constants/price-rule.constants';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { PriceRuleKeyName } from '../../domain/types/price-rule-record.type';
import { PriceValueResDto } from '../dto/res.dto';

export type PriceFieldDefinition = (typeof PRICE_FIELDS)[number];

/** Tên field khóa trường theo nhóm. */
export function keyNameOf(group: PriceGroup): PriceRuleKeyName {
  return group === PriceGroup.SEAT ? 'seatType' : 'dayType';
}

/** Tra PRICE_FIELDS; sai group/fieldKey (kể cả STANDARD/WEEKDAY) -> 400 MSG_INVALID_FIELD. */
export function resolvePriceField(
  group: PriceGroup,
  fieldKey: string,
): PriceFieldDefinition {
  const field = PRICE_FIELDS.find(
    (f) => f.group === group && String(f.fieldKey) === fieldKey,
  );
  if (!field) throw new BadRequestException(MSG_INVALID_FIELD);
  return field;
}

/** Ánh xạ document (adjustmentValue) sang DTO (multiplier). */
export function toPriceValueDto(doc: {
  ruleId: string;
  adjustmentValue: number;
}): PriceValueResDto {
  return {
    ruleId: doc.ruleId,
    multiplier: doc.adjustmentValue,
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
  };
}
