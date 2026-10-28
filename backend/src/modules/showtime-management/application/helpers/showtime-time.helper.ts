import { CINEMA_UTC_OFFSET_MINUTES } from '../../domain/constants/showtime-management.constants';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function parseDate(
  screeningDate: string,
): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(screeningDate);
  if (!match) {
    return null;
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Loại ngày không tồn tại trên lịch (vd 2026-02-30)
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/** Quy đổi ngày + giờ theo giờ rạp (UTC+7) sang Date UTC; null nếu ngày/giờ không hợp lệ. */
export function toUtcDate(
  screeningDate: string,
  startTime: string,
): Date | null {
  const date = parseDate(screeningDate);
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  if (!date || !time) {
    return null;
  }
  const utcMs =
    Date.UTC(date.y, date.m - 1, date.d, Number(time[1]), Number(time[2])) -
    CINEMA_UTC_OFFSET_MINUTES * MINUTE_MS;
  return new Date(utcMs);
}

/** BR-BRM-02: endTime = startTime + duration (phút). */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/** Khoảng [00:00, 24:00) giờ rạp quy ra UTC; `to` là cận trên loại trừ. */
export function vnDayRangeUtc(
  screeningDate: string,
): { from: Date; to: Date } | null {
  const date = parseDate(screeningDate);
  if (!date) {
    return null;
  }
  const fromMs =
    Date.UTC(date.y, date.m - 1, date.d) -
    CINEMA_UTC_OFFSET_MINUTES * MINUTE_MS;
  return { from: new Date(fromMs), to: new Date(fromMs + DAY_MS) };
}

/** 00:00 hôm nay theo giờ rạp, quy ra UTC. */
export function startOfTodayVnUtc(now: Date): Date {
  const offsetMs = CINEMA_UTC_OFFSET_MINUTES * MINUTE_MS;
  const localMs = now.getTime() + offsetMs;
  const startLocalMs = localMs - (((localMs % DAY_MS) + DAY_MS) % DAY_MS);
  return new Date(startLocalMs - offsetMs);
}
