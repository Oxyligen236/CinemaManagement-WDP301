/**
 * Vietnam Timezone (Asia/Ho_Chi_Minh, UTC+07:00) helpers.
 * Handles deterministic conversions between Vietnam calendar dates/times and UTC Date objects.
 */
export class VietnamTime {
  static readonly TIMEZONE = 'Asia/Ho_Chi_Minh';
  static readonly OFFSET_HOURS = 7;
  static readonly OFFSET_MS = 7 * 60 * 60 * 1000;

  /**
   * Return current date string in Vietnam (YYYY-MM-DD).
   */
  static today(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  /**
   * Calculate absolute start and end Date for a shift on a specific calendar date in Vietnam.
   * If endTime <= startTime, the shift is overnight and ends on the next calendar day.
   */
  static getShiftRange(
    dateStr: string,
    startTime: string,
    endTime: string,
  ): { startAt: Date; endAt: Date; isOvernight: boolean } {
    const [year, month, day] = dateStr.split('-').map(Number);
    const parseTime = (time: string, dayOffset = 0): Date => {
      const [hours, minutes] = time.split(':').map(Number);
      return new Date(
        Date.UTC(year, month - 1, day + dayOffset, hours, minutes) -
          this.OFFSET_MS,
      );
    };

    const startAt = parseTime(startTime, 0);
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const isOvernight = endH * 60 + endM <= startH * 60 + startM;
    const endAt = parseTime(endTime, isOvernight ? 1 : 0);

    return { startAt, endAt, isOvernight };
  }

  /**
   * Check if a shift scheduled for dateStr has already ended relative to now.
   */
  static isShiftExpired(
    dateStr: string,
    startTime: string,
    endTime: string,
    now = new Date(),
  ): boolean {
    const { endAt } = this.getShiftRange(dateStr, startTime, endTime);
    return now.getTime() >= endAt.getTime();
  }
}
