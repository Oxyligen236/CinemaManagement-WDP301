export const SHOWTIME_SCHEDULE_MESSAGES = {
  MSG03:
    'The screening room already has a showtime in this time slot. Please choose another room or time slot.',
  MSG04: 'Cannot edit a showtime that already has tickets sold.',
  MSG05: 'Cannot delete a showtime that already has tickets sold.',
  MSG_SHOWTIME_NOT_FOUND: 'Showtime not found.',
  MSG_SCHEDULE_FAILED:
    'Unable to save showtime due to system failure. Please try again later.',
} as const;

export const SHOWTIME_ERROR_CODES = {
  ROOM_CONFLICT: 'ROOM_CONFLICT',
  SHOWTIME_SOLD: 'SHOWTIME_SOLD',
} as const;
