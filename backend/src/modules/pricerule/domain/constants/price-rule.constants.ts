import { DayType } from '../enums/day-type.enum';
import { PriceGroup } from '../enums/price-group.enum';
import { SeatType } from '../enums/seat-type.enum';

export const MULTIPLIER_MIN = 1.0;
export const MULTIPLIER_MAX = 10; // giả định, cần BA xác nhận (plan mục 8)
export const MULTIPLIER_MAX_DECIMALS = 2;
export const DEFAULT_MULTIPLIER = 1.0; // hệ số khi trường không có giá trị / không được chọn
export const MAX_VALUES_PER_FIELD = 20; // giả định, cần BA xác nhận (plan mục 8)

/** Các trường cấu hình được, thứ tự hiển thị cố định. */
export const PRICE_FIELDS = [
  {
    group: PriceGroup.SEAT,
    fieldKey: SeatType.VIP,
    label: 'VIP Seat Multiplier',
  },
  {
    group: PriceGroup.SEAT,
    fieldKey: SeatType.COUPLE,
    label: 'Couple Seat Multiplier',
  },
  {
    group: PriceGroup.DAY,
    fieldKey: DayType.WEEKEND,
    label: 'Weekend Multiplier',
  },
  {
    group: PriceGroup.DAY,
    fieldKey: DayType.HOLIDAY,
    label: 'Holiday Multiplier',
  },
] as const;

export const msg02 = (label: string) => `The ${label} field is required.`;
export const MSG03 = 'Update asset(s) successfully.';
export const MSG_CREATE_SUCCESS = 'Create asset(s) successfully.';
export const MSG_DELETE_SUCCESS = 'Delete asset(s) successfully.';
export const MSG_INVALID_MULTIPLIER =
  'Multiplier value must be a valid positive number.';
export const MSG_INVALID_FIELD = 'Invalid price field.';
export const MSG_INVALID_SELECTION =
  'Selected price value is invalid or no longer available.';
export const MSG_DUPLICATE_MULTIPLIER =
  'This multiplier value already exists for this field.';
export const MSG_MAX_VALUES = 'A field can have at most 20 values.';
export const MSG_NOT_FOUND = 'Price value not found.';
export const MSG_SAVE_FAILED =
  'Unable to save pricing configurations due to system failure. Please try again later.';
export const MSG_LOAD_FAILED = 'Unable to load pricing configurations.';
export const MSG_VALIDATION_FAILED = 'Validation failed';
