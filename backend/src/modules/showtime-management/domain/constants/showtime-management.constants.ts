export const DEFAULT_BASE_PRICE = 75000;

// Giờ rạp: Asia/Ho_Chi_Minh (UTC+7, không có DST)
export const CINEMA_UTC_OFFSET_MINUTES = 420;

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const msg01 = (label: string): string =>
  `The ${label} field is required.`;

export const MSG02 = 'Changes saved successfully.';
export const MSG_INVALID_DATE = 'Screening date is invalid.';
export const MSG_INVALID_TIME = 'Start time is invalid. Use HH:mm.';
export const MSG_PAST_START = 'Start time must be in the future.';
export const MSG_INVALID_MOVIE =
  'Selected movie is invalid or no longer available.';
export const MSG_INVALID_ROOM = 'Selected screening room is invalid.';
export const MSG_ROOM_NOT_ACTIVE = 'Selected screening room is not active.';
export const MSG_NO_BRANCH = 'Your account is not assigned to a branch.';
export const MSG_NOT_FOUND = 'Showtime not found.';
export const MSG_STARTED_EDIT =
  'Cannot edit a showtime that has already started or ended.';
export const MSG_STARTED_DELETE =
  'Cannot delete a showtime that has already started or ended.';
export const CODE_SHOWTIME_STARTED = 'SHOWTIME_STARTED';
export const MSG_SAVE_FAILED =
  'Unable to save showtime due to system failure. Please try again later.';
export const MSG_LOAD_FAILED = 'Unable to load showtimes.';
export const MSG_VALIDATION_FAILED = 'Validation failed';
