import {
  addMinutes,
  startOfTodayVnUtc,
  toUtcDate,
  vnDayRangeUtc,
} from './showtime-time.helper';

describe('showtime-time.helper', () => {
  describe('toUtcDate', () => {
    it('quy đổi giờ rạp (UTC+7) sang UTC', () => {
      expect(toUtcDate('2026-10-25', '09:30')?.toISOString()).toBe(
        '2026-10-25T02:30:00.000Z',
      );
    });

    it('lùi sang ngày hôm trước khi giờ rạp trước 07:00', () => {
      expect(toUtcDate('2026-10-25', '03:00')?.toISOString()).toBe(
        '2026-10-24T20:00:00.000Z',
      );
    });

    it('trả null khi ngày không tồn tại trên lịch', () => {
      expect(toUtcDate('2026-02-30', '10:00')).toBeNull();
    });

    it('trả null khi sai định dạng ngày hoặc giờ', () => {
      expect(toUtcDate('25/10/2026', '10:00')).toBeNull();
      expect(toUtcDate('2026-10-25', '24:00')).toBeNull();
      expect(toUtcDate('2026-10-25', '9:30')).toBeNull();
    });
  });

  describe('addMinutes', () => {
    it('cộng thời lượng phim vào giờ bắt đầu (BR-BRM-02)', () => {
      const start = new Date('2026-10-25T02:30:00.000Z');
      expect(addMinutes(start, 166).toISOString()).toBe(
        '2026-10-25T05:16:00.000Z',
      );
    });
  });

  describe('vnDayRangeUtc', () => {
    it('trả khoảng [00:00, 24:00) giờ rạp quy ra UTC', () => {
      const range = vnDayRangeUtc('2026-10-25');
      expect(range?.from.toISOString()).toBe('2026-10-24T17:00:00.000Z');
      expect(range?.to.toISOString()).toBe('2026-10-25T17:00:00.000Z');
    });

    it('trả null khi ngày không hợp lệ', () => {
      expect(vnDayRangeUtc('2026-13-01')).toBeNull();
    });
  });

  describe('startOfTodayVnUtc', () => {
    it('lấy 00:00 hôm nay theo giờ rạp', () => {
      expect(
        startOfTodayVnUtc(new Date('2026-10-25T10:00:00.000Z')).toISOString(),
      ).toBe('2026-10-24T17:00:00.000Z');
    });

    it('tính đúng ngày giờ rạp khi UTC vẫn là hôm trước', () => {
      expect(
        startOfTodayVnUtc(new Date('2026-10-25T18:00:00.000Z')).toISOString(),
      ).toBe('2026-10-25T17:00:00.000Z');
    });
  });
});
