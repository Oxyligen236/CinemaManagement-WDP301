import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatCurrency,
  formatDateTime,
  formatDiscount,
  toInputDateTimeLocal,
} from '@/lib/utils/formatters';
import {
  ORDER_HOLD_TIMEOUT_MS,
  extractErrorMessage,
  isOrderHoldExpired,
} from '@/lib/utils/order.helper';

describe('lib/utils/formatters', () => {
  describe('formatCurrency', () => {
    it('formats VND amounts using vi-VN locale', () => {
      const expectedZero = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(0);
      const expectedAmount = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(125000);

      expect(formatCurrency(0)).toBe(expectedZero);
      expect(formatCurrency(125000)).toBe(expectedAmount);
    });
  });

  describe('formatDateTime', () => {
    it('returns empty string for empty or invalid date values', () => {
      expect(formatDateTime('')).toBe('');
      expect(formatDateTime('invalid-date')).toBe('');
    });

    it('formats Date object and ISO string in Asia/Ho_Chi_Minh timezone', () => {
      const iso = '2026-05-01T10:30:00.000Z';
      const expected = new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(iso));

      expect(formatDateTime(iso)).toBe(expected);
      expect(formatDateTime(new Date(iso))).toBe(expected);
    });
  });

  describe('formatDiscount', () => {
    it('formats PERCENTAGE with % suffix and FIXED_AMOUNT as currency', () => {
      expect(formatDiscount('PERCENTAGE', 25)).toBe('25%');
      expect(formatDiscount('FIXED_AMOUNT', 50000)).toBe(formatCurrency(50000));
    });
  });

  describe('toInputDateTimeLocal', () => {
    it('returns empty string when input is undefined, empty, or invalid', () => {
      expect(toInputDateTimeLocal()).toBe('');
      expect(toInputDateTimeLocal('')).toBe('');
      expect(toInputDateTimeLocal('not-a-date')).toBe('');
    });

    it('formats valid ISO string to local YYYY-MM-DDTHH:mm string', () => {
      const input = '2026-05-01T10:30:00.000Z';
      const d = new Date(input);
      const expected = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      expect(toInputDateTimeLocal(input)).toBe(expected);
      expect(toInputDateTimeLocal(input)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });
});

describe('lib/utils/order.helper', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defines 10-minute hold timeout constant', () => {
    expect(ORDER_HOLD_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });

  describe('extractErrorMessage', () => {
    it('returns fallback when error is falsy or has no extractable string message', () => {
      expect(extractErrorMessage(null)).toBe('Hủy đơn hàng thất bại');
      expect(extractErrorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
      expect(extractErrorMessage({}, 'Fallback')).toBe('Fallback');
      expect(extractErrorMessage({ response: { data: { message: 123 } } }, 'Fallback')).toBe(
        'Fallback',
      );
      expect(extractErrorMessage('plain string', 'Fallback')).toBe('Fallback');
    });

    it('extracts message from response.data.message, data.message, object.message, and Error', () => {
      expect(
        extractErrorMessage({
          response: { data: { message: 'Response data message' } },
          data: { message: 'Data message' },
          message: 'Direct message',
        }),
      ).toBe('Response data message');

      expect(
        extractErrorMessage({
          data: { message: 'Data message' },
          message: 'Direct message',
        }),
      ).toBe('Data message');

      expect(extractErrorMessage({ message: 'Direct message' })).toBe('Direct message');
      expect(extractErrorMessage(new Error('Standard error message'))).toBe(
        'Standard error message',
      );
    });

    it('handles Error instance whose own message property is non-string via instanceof branch', () => {
      const weirdError = new Error('Fallback instance message');
      Object.defineProperty(weirdError, 'message', {
        get: (() => {
          let calls = 0;
          return () => {
            calls += 1;
            return calls === 1 ? undefined : 'Recovered error message';
          };
        })(),
      });
      expect(extractErrorMessage(weirdError)).toBe('Recovered error message');
    });
  });

  describe('isOrderHoldExpired', () => {
    it('returns false when status is not PENDING, createdAt is missing, or createdAt is invalid', () => {
      expect(isOrderHoldExpired('2026-01-01T00:00:00.000Z', 'PAID')).toBe(false);
      expect(isOrderHoldExpired('2026-01-01T00:00:00.000Z', 'CANCELLED')).toBe(false);
      expect(isOrderHoldExpired('2026-01-01T00:00:00.000Z', undefined)).toBe(false);
      expect(isOrderHoldExpired(undefined, 'PENDING')).toBe(false);
      expect(isOrderHoldExpired('', 'PENDING')).toBe(false);
      expect(isOrderHoldExpired('invalid-date', 'PENDING')).toBe(false);
    });

    it('returns false within 10 minutes and true after 10 minutes for PENDING orders', () => {
      vi.useFakeTimers();
      const now = new Date('2026-05-01T12:00:00.000Z');
      vi.setSystemTime(now);

      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const exactlyTenMinAgo = new Date(now.getTime() - ORDER_HOLD_TIMEOUT_MS).toISOString();
      const tenMinOneMsAgo = new Date(now.getTime() - ORDER_HOLD_TIMEOUT_MS - 1);

      expect(isOrderHoldExpired(fiveMinAgo, 'PENDING')).toBe(false);
      expect(isOrderHoldExpired(exactlyTenMinAgo, 'PENDING')).toBe(false);
      expect(isOrderHoldExpired(tenMinOneMsAgo, 'PENDING')).toBe(true);
    });
  });
});
