import { BadRequestException } from '@nestjs/common';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import {
  keyNameOf,
  resolvePriceField,
  toPriceValueDto,
} from './price-rule.helper';

describe('price-rule.helper', () => {
  describe('keyNameOf', () => {
    it('returns seatType for SEAT and dayType for DAY', () => {
      expect(keyNameOf(PriceGroup.SEAT)).toBe('seatType');
      expect(keyNameOf(PriceGroup.DAY)).toBe('dayType');
    });
  });

  describe('resolvePriceField', () => {
    it('resolves valid SEAT and DAY fields', () => {
      expect(resolvePriceField(PriceGroup.SEAT, 'VIP').label).toBe(
        'VIP Seat Multiplier',
      );
      expect(resolvePriceField(PriceGroup.DAY, 'WEEKEND').label).toBe(
        'Weekend Multiplier',
      );
    });

    it('throws BadRequestException for invalid field', () => {
      expect(() => resolvePriceField(PriceGroup.SEAT, 'STANDARD')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('toPriceValueDto', () => {
    it('maps ruleId, normalized multiplier, and optional updatedAt', () => {
      const updatedAt = new Date('2026-01-01T00:00:00.000Z');
      expect(
        toPriceValueDto({
          ruleId: 'r-1',
          adjustmentValue: 1.5,
          updatedAt,
        }),
      ).toEqual({
        ruleId: 'r-1',
        multiplier: 1.5,
        updatedAt,
      });

      expect(
        toPriceValueDto({
          ruleId: 'r-2',
          adjustmentValue: 1.25,
        }),
      ).toEqual({
        ruleId: 'r-2',
        multiplier: 1.25,
        updatedAt: undefined,
      });
    });
  });
});
