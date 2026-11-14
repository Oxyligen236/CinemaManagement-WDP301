import { BadRequestException } from '@nestjs/common';
import {
  buildMultiplierValidationException,
  isValidMultiplier,
  normalizeMultiplier,
  validateMultiplier,
} from './multiplier-validation.helper';
import {
  MSG_INVALID_MULTIPLIER,
  MSG_VALIDATION_FAILED,
  msg02,
} from '../../domain/constants/price-rule.constants';

describe('multiplier-validation.helper', () => {
  describe('isValidMultiplier', () => {
    it('accepts integers and decimals up to 2 places within [1.0, 10]', () => {
      expect(isValidMultiplier(1)).toBe(true);
      expect(isValidMultiplier(1.5)).toBe(true);
      expect(isValidMultiplier(2.75)).toBe(true);
      expect(isValidMultiplier(10)).toBe(true);
    });

    it('rejects out-of-range, non-finite, non-number, or >2 decimal places', () => {
      expect(isValidMultiplier('1.5')).toBe(false);
      expect(isValidMultiplier(Number.NaN)).toBe(false);
      expect(isValidMultiplier(0.99)).toBe(false);
      expect(isValidMultiplier(10.01)).toBe(false);
      expect(isValidMultiplier(1.234)).toBe(false);
    });
  });

  describe('normalizeMultiplier', () => {
    it('rounds to 2 decimal places', () => {
      expect(normalizeMultiplier(1.25)).toBe(1.25);
      expect(normalizeMultiplier(1.254)).toBe(1.25);
    });
  });

  describe('validateMultiplier', () => {
    it('returns required error for undefined, null, or blank string', () => {
      expect(validateMultiplier(undefined)).toEqual({
        field: 'multiplier',
        message: msg02('Multiplier'),
      });
      expect(validateMultiplier(null)).toEqual({
        field: 'multiplier',
        message: msg02('Multiplier'),
      });
      expect(validateMultiplier('')).toEqual({
        field: 'multiplier',
        message: msg02('Multiplier'),
      });
    });

    it('returns invalid error for invalid multiplier', () => {
      expect(validateMultiplier(0.5)).toEqual({
        field: 'multiplier',
        message: MSG_INVALID_MULTIPLIER,
      });
    });

    it('returns undefined for valid multiplier', () => {
      expect(validateMultiplier(1.25)).toBeUndefined();
    });
  });

  describe('buildMultiplierValidationException', () => {
    it('creates BadRequestException with standard payload', () => {
      const ex = buildMultiplierValidationException([
        { field: 'multiplier', message: MSG_INVALID_MULTIPLIER },
      ]);
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(ex.getResponse()).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: MSG_VALIDATION_FAILED,
        errors: [{ field: 'multiplier', message: MSG_INVALID_MULTIPLIER }],
      });
    });
  });
});
