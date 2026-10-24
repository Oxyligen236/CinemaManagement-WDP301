import { BadRequestException } from '@nestjs/common';
import {
  addMinutes,
  startOfTodayVnUtc,
  toUtcDate,
  vnDayRangeUtc,
} from './showtime-time.helper';

describe('showtime-time.helper', () => {
  describe('toUtcDate', () => {
    it('09:30 giờ VN -> 02:30Z cùng ngày', () => {
      expect(toUtcDate('2026-10-25', '09:30').toISOString()).toBe(
        '2026-10-25T02:30:00.000Z',
      );
    });

    it('00:30 giờ VN -> 17:30Z ngày hôm trước', () => {
      expect(toUtcDate('2026-10-25', '00:30').toISOString()).toBe(
        '2026-10-24T17:30:00.000Z',
      );
    });

    it('23:30 giờ VN -> 16:30Z cùng ngày', () => {
      expect(toUtcDate('2026-10-25', '23:30').toISOString()).toBe(
        '2026-10-25T16:30:00.000Z',
      );
    });

    it('ngày không tồn tại hoặc sai định dạng -> 400 MSG_INVALID_DATE', () => {
      for (const date of ['2026-02-30', '25/10/2026', '2026-13-01']) {
        expect(() => toUtcDate(date, '09:30')).toThrow(BadRequestException);
        try {
          toUtcDate(date, '09:30');
        } catch (e) {
          expect((e as BadRequestException).getResponse()).toMatchObject({
            errors: [
              { field: 'screeningDate', message: 'Screening date is invalid.' },
            ],
          });
        }
      }
    });

    it('giờ sai định dạng -> 400 MSG_INVALID_TIME', () => {
      for (const time of ['9:30', '24:00', '09:60']) {
        expect(() => toUtcDate('2026-10-25', time)).toThrow(
          BadRequestException,
        );
      }
    });
  });

  describe('addMinutes', () => {
    it('cộng thời lượng phim (BR-BRM-02)', () => {
      const start = new Date('2026-10-25T02:30:00Z');
      expect(addMinutes(start, 166).toISOString()).toBe(
        '2026-10-25T05:16:00.000Z',
      );
    });

    it('qua nửa đêm', () => {
      const start = toUtcDate('2026-10-25', '23:30');
      expect(addMinutes(start, 166).toISOString()).toBe(
        '2026-10-25T19:16:00.000Z',
      );
    });

    it('không đổi Date đầu vào', () => {
      const start = new Date('2026-10-25T02:30:00Z');
      addMinutes(start, 10);
      expect(start.toISOString()).toBe('2026-10-25T02:30:00.000Z');
    });
  });

  describe('vnDayRangeUtc', () => {
    it('[00:00, 24:00) giờ VN quy ra UTC', () => {
      const { from, to } = vnDayRangeUtc('2026-10-25');
      expect(from.toISOString()).toBe('2026-10-24T17:00:00.000Z');
      expect(to.toISOString()).toBe('2026-10-25T17:00:00.000Z');
    });

    it('ngày không hợp lệ -> 400', () => {
      expect(() => vnDayRangeUtc('2026-02-30')).toThrow(BadRequestException);
    });
  });

  describe('startOfTodayVnUtc', () => {
    it('10:00 VN -> 00:00 VN hôm nay', () => {
      expect(
        startOfTodayVnUtc(new Date('2026-10-23T03:00:00Z')).toISOString(),
      ).toBe('2026-10-22T17:00:00.000Z');
    });

    it('23:59 VN vẫn thuộc hôm nay', () => {
      expect(
        startOfTodayVnUtc(new Date('2026-10-23T16:59:00Z')).toISOString(),
      ).toBe('2026-10-22T17:00:00.000Z');
    });

    it('00:00 VN là đầu ngày mới', () => {
      expect(
        startOfTodayVnUtc(new Date('2026-10-23T17:00:00Z')).toISOString(),
      ).toBe('2026-10-23T17:00:00.000Z');
    });
  });
});
