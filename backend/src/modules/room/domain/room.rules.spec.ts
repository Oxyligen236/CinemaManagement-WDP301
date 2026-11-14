import { SeatStatus } from './enums/seat-status.enum';
import { isSeatBrokenStatus } from './room.rules';

describe('room.rules', () => {
  describe('isSeatBrokenStatus', () => {
    it('returns true for MAINTENANCE and BLOCKED seats', () => {
      expect(isSeatBrokenStatus(SeatStatus.MAINTENANCE)).toBe(true);
      expect(isSeatBrokenStatus(SeatStatus.BLOCKED)).toBe(true);
    });

    it('returns false for AVAILABLE seats', () => {
      expect(isSeatBrokenStatus(SeatStatus.AVAILABLE)).toBe(false);
    });
  });
});
