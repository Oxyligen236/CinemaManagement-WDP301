import {
  CINEMA_UTC_OFFSET_MINUTES,
  DATE_PATTERN,
  MSG_INVALID_DATE,
  MSG_INVALID_TIME,
  TIME_PATTERN,
} from '../../domain/constants/showtime-management.constants';
import { fieldValidationException } from './showtime-management-validation.helper';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const OFFSET_MS = CINEMA_UTC_OFFSET_MINUTES * MINUTE_MS;

/** Ngày lịch hợp lệ (loại 2026-02-30) -> mốc UTC 00:00 của ngày đó (chưa trừ offset). */
function parseCalendarDate(screeningDate: string): number {
  if (!DATE_PATTERN.test(screeningDate)) {
    throw fieldValidationException('screeningDate', MSG_INVALID_DATE);
  }
  const [year, month, day] = screeningDate.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw fieldValidationException('screeningDate', MSG_INVALID_DATE);
  }
  return utc;
}

/** Ngày (YYYY-MM-DD) + giờ (HH:mm) theo giờ rạp (UTC+7) -> Date UTC. */
export function toUtcDate(screeningDate: string, startTime: string): Date {
  const dayUtc = parseCalendarDate(screeningDate);
  if (!TIME_PATTERN.test(startTime)) {
    throw fieldValidationException('startTime', MSG_INVALID_TIME);
  }
  const [hours, minutes] = startTime.split(':').map(Number);
  return new Date(dayUtc + (hours * 60 + minutes) * MINUTE_MS - OFFSET_MS);
}

/** BR-BRM-02: endTime = startTime + duration (phút). */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/** Khoảng [00:00, 24:00) giờ rạp quy ra UTC; `to` là cận trên loại trừ. */
export function vnDayRangeUtc(screeningDate: string): {
  from: Date;
  to: Date;
} {
  const from = parseCalendarDate(screeningDate) - OFFSET_MS;
  return { from: new Date(from), to: new Date(from + DAY_MS) };
}

/** 00:00 hôm nay theo giờ rạp, quy ra UTC. */
export function startOfTodayVnUtc(now: Date): Date {
  const local = now.getTime() + OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - OFFSET_MS);
}
