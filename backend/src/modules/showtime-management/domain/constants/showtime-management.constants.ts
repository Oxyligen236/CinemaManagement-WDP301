export const msg01 = (label: string) => `The ${label} field is required.`;
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
export const MSG_SAVE_FAILED =
  'Unable to save showtime due to system failure. Please try again later.';
export const MSG_LOAD_FAILED = 'Unable to load showtimes.';
export const MSG_VALIDATION_FAILED = 'Validation failed';

// Cùng văn bản với ShowtimeScheduleService (module showtime): kiểm tra bán vé trước khi xác thực dữ liệu PATCH/DELETE
export const MSG04 = 'Cannot edit a showtime that already has tickets sold.';
export const MSG05 = 'Cannot delete a showtime that already has tickets sold.';
export const MSG_CODE_SHOWTIME_SOLD = 'SHOWTIME_SOLD';

export const MOVIE_STATUS_ENDED = 'ENDED';
export const ROOM_STATUS_AVAILABLE = 'AVAILABLE';

/** Nhãn hiển thị trong MSG01 theo tên trường của SaveShowtimeReqDto. */
export const REQUIRED_FIELD_LABELS: Readonly<Record<string, string>> = {
  movieId: 'Movie',
  screeningDate: 'Date',
  startTime: 'Start time',
  roomId: 'Screening room',
};

export const DEFAULT_BASE_PRICE = 75000; // VND, cần BA xác nhận (plan mục 9)
export const CINEMA_UTC_OFFSET_MINUTES = 420; // Asia/Ho_Chi_Minh (UTC+7, không DST)

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
