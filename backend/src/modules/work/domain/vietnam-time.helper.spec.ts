import { VietnamTime } from './vietnam-time.helper';

describe('VietnamTime', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('today', () => {
    it('returns YYYY-MM-DD in Asia/Ho_Chi_Minh timezone using default current time', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T18:30:00Z')); // 2026-11-02 01:30 VN
      expect(VietnamTime.today()).toBe('2026-11-02');
    });

    it('formats an explicit Date in Vietnam timezone', () => {
      expect(VietnamTime.today(new Date('2026-11-01T16:59:59Z'))).toBe(
        '2026-11-01',
      );
      expect(VietnamTime.today(new Date('2026-11-01T17:00:00Z'))).toBe(
        '2026-11-02',
      );
    });
  });

  describe('getShiftRange', () => {
    it('computes daytime shift range in UTC', () => {
      const range = VietnamTime.getShiftRange('2026-11-01', '09:00', '17:30');
      expect(range.isOvernight).toBe(false);
      expect(range.startAt.toISOString()).toBe('2026-11-01T02:00:00.000Z');
      expect(range.endAt.toISOString()).toBe('2026-11-01T10:30:00.000Z');
    });

    it('computes overnight shift range ending on the next Vietnam calendar day', () => {
      const range = VietnamTime.getShiftRange('2026-11-01', '22:00', '06:00');
      expect(range.isOvernight).toBe(true);
      expect(range.startAt.toISOString()).toBe('2026-11-01T15:00:00.000Z');
      expect(range.endAt.toISOString()).toBe('2026-11-01T23:00:00.000Z');
    });

    it('treats equal start and end times as overnight', () => {
      const range = VietnamTime.getShiftRange('2026-11-01', '08:00', '08:00');
      expect(range.isOvernight).toBe(true);
      expect(range.endAt.getTime() - range.startAt.getTime()).toBe(
        24 * 60 * 60 * 1000,
      );
    });
  });

  describe('isShiftExpired', () => {
    it('returns false before endAt and true at or after endAt', () => {
      expect(
        VietnamTime.isShiftExpired(
          '2026-11-01',
          '09:00',
          '17:00',
          new Date('2026-11-01T09:59:59Z'),
        ),
      ).toBe(false);
      expect(
        VietnamTime.isShiftExpired(
          '2026-11-01',
          '09:00',
          '17:00',
          new Date('2026-11-01T10:00:00Z'),
        ),
      ).toBe(true);
    });

    it('uses current system time when now is omitted', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-01T11:00:00Z'));
      expect(VietnamTime.isShiftExpired('2026-11-01', '09:00', '17:00')).toBe(
        true,
      );
    });
  });
});
