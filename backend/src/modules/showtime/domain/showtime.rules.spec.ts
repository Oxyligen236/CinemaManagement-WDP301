import { RoomStatus } from '../../room/domain/enums/room-status.enum';
import { SeatShowtimeStatus } from './enums/seat-showtime-status.enum';
import {
  calculateShowtimeEndTime,
  isRoomAssignable,
  LOCKED_SEAT_SHOWTIME_STATUSES,
} from './showtime.rules';

describe('showtime.rules', () => {
  describe('calculateShowtimeEndTime', () => {
    it('adds durationMinutes to startTime', () => {
      const start = new Date('2026-11-15T10:00:00.000Z');
      expect(calculateShowtimeEndTime(start, 135)).toEqual(
        new Date('2026-11-15T12:15:00.000Z'),
      );
    });
  });

  describe('isRoomAssignable', () => {
    it('returns true only when room status is AVAILABLE', () => {
      expect(isRoomAssignable(RoomStatus.AVAILABLE)).toBe(true);
      expect(isRoomAssignable(RoomStatus.MAINTENANCE)).toBe(false);
    });
  });

  it('locks BOOKED and RESERVED seat statuses', () => {
    expect(LOCKED_SEAT_SHOWTIME_STATUSES).toEqual([
      SeatShowtimeStatus.BOOKED,
      SeatShowtimeStatus.RESERVED,
    ]);
  });
});
