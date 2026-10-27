export type PriceGroup = "SEAT" | "DAY";
export type RoomStatus = "AVAILABLE" | "MAINTENANCE" | "CLOSED";

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ManagerContext {
  branchId: string;
  branchName: string;
}

export interface MovieOption {
  movieId: string;
  movieName: string;
  duration: number;
  status: string;
  posterUrl?: string;
}

/** Minimal movie data kept by the form (an edited showtime may use a movie that is no longer listed). */
export interface MovieChoice {
  movieId: string;
  movieName: string;
  duration: number;
  posterUrl?: string;
}

export interface RoomOption {
  roomId: string;
  roomName: string;
  roomStatus: RoomStatus | string;
  branchId: string;
}

export interface PriceValue {
  ruleId: string;
  multiplier: number;
}

export interface PriceOptionField {
  group: PriceGroup;
  fieldKey: string;
  label: string;
  values: PriceValue[];
}

export interface SeatPriceSelection {
  seatType: string;
  ruleId: string | null;
  multiplier: number;
}

export interface DayPriceSelection {
  dayType: string;
  ruleId: string | null;
  multiplier: number;
}

export interface ManagedShowtime {
  showtimeId: string;
  movieId: string;
  movieName: string;
  movieDuration: number;
  posterUrl?: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  seatPriceSelections: SeatPriceSelection[];
  dayPriceSelections: DayPriceSelection[];
  hasSoldTickets: boolean;
}

export interface ShowtimeMutation {
  message: string;
  showtime: ManagedShowtime;
}

export interface PriceSelectionPayload {
  group: PriceGroup;
  fieldKey: string;
  ruleId: string;
}

export interface SaveShowtimePayload {
  movieId: string;
  screeningDate: string;
  startTime: string;
  roomId: string;
  basePrice?: number;
  priceSelections?: PriceSelectionPayload[];
}

export interface ShowtimeQuery {
  page: number;
  limit: number;
  date?: string;
  movieId?: string;
  roomId?: string;
  includePast?: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly errors: FieldError[] = [],
  ) {
    super(message);
  }
}

export const msg01 = (label: string) => `The ${label} field is required.`;
export const MSG02 = "Changes saved successfully.";
export const MSG03 =
  "The screening room already has a showtime in this time slot. Please choose another room or time slot.";
export const MSG04 = "Cannot edit a showtime that already has tickets sold.";
export const MSG05 = "Cannot delete a showtime that already has tickets sold.";
export const MSG_NOT_FOUND = "Showtime not found.";
export const MSG_SAVE_FAILED =
  "Unable to save showtime due to system failure. Please try again later.";
export const MSG_LOAD_FAILED = "Unable to load showtimes.";
export const MSG_OPTIONS_FAILED = "Unable to load form options.";
export const MSG_NO_PERMISSION = "Bạn không có quyền thực hiện thao tác này.";

export const CODE_ROOM_CONFLICT = "ROOM_CONFLICT";
export const CODE_SHOWTIME_SOLD = "SHOWTIME_SOLD";
export const CODE_SHOWTIME_STARTED = "SHOWTIME_STARTED";
export const MSG_STARTED_EDIT =
  "Cannot edit a showtime that has already started or ended.";
export const MSG_STARTED_DELETE =
  "Cannot delete a showtime that has already started or ended.";

export const CINEMA_TIME_ZONE = "Asia/Ho_Chi_Minh";
const CINEMA_UTC_OFFSET_MINUTES = 420;

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: CINEMA_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: CINEMA_TIME_ZONE,
});

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: CINEMA_TIME_ZONE,
});

export const formatDate = (iso: string | Date): string =>
  dateFormatter.format(new Date(iso));

export const formatTime = (iso: string | Date): string =>
  timeFormatter.format(new Date(iso));

/** Splits an instant into cinema-local `YYYY-MM-DD` and `HH:mm` strings. */
export function toCinemaParts(iso: string | Date): {
  date: string;
  time: string;
} {
  const map: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(new Date(iso))) {
    map[part.type] = part.value;
  }
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

/**
 * BR-BRM-02 preview: end = start + duration, interpreted in cinema time
 * (Asia/Ho_Chi_Minh, UTC+7). The server always recalculates the real value.
 */
export function previewEndTime(
  screeningDate: string,
  startTime: string,
  durationMinutes: number,
): { time: string; nextDay: boolean } | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(screeningDate);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!dateMatch || !timeMatch || !(durationMinutes > 0)) return null;
  const startUtc =
    Date.UTC(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(timeMatch[1]),
      Number(timeMatch[2]),
    ) -
    CINEMA_UTC_OFFSET_MINUTES * 60_000;
  if (Number.isNaN(startUtc)) return null;
  const end = new Date(startUtc + durationMinutes * 60_000);
  const parts = toCinemaParts(end);
  return { time: parts.time, nextDay: parts.date !== screeningDate };
}

/** Cinema-local `YYYY-MM-DD` + `HH:mm` -> the real instant (Asia/Ho_Chi_Minh, UTC+7). */
export function toInstant(
  screeningDate: string,
  startTime: string,
): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(screeningDate);
  const t = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!d || !t) return null;
  const ms =
    Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) -
    CINEMA_UTC_OFFSET_MINUTES * 60_000;
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Adds calendar days to a `YYYY-MM-DD` string without any timezone drift. */
export function addDaysToDate(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}-${mm}-${dd}`;
}

export const formatMultiplier = (value: number): string =>
  String(Number(value.toFixed(2)));

export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return viMessage(err.message) || MSG_NO_PERMISSION;
    if (err.status >= 500) return fallback;
    return viMessage(err.message) || fallback;
  }
  return fallback;
}

/** Vietnamese labels for the backend's English messages, keyed by the exact BE text. */
const VI_MESSAGES: Record<string, string> = {
  [MSG02]: "Lưu thay đổi thành công.",
  [MSG03]:
    "Phòng chiếu đã có suất chiếu khác trùng trong khung giờ này. Vui lòng chọn phòng hoặc khung giờ khác.",
  [MSG04]: "Phim đã bán vé, không thể sửa.",
  [MSG05]: "Phim đã bán vé, không thể xóa.",
  [MSG_STARTED_EDIT]: "Phim đã/đang chiếu, không thể sửa.",
  [MSG_STARTED_DELETE]: "Phim đã/đang chiếu, không thể xóa.",
  [MSG_NOT_FOUND]: "Không tìm thấy suất chiếu trong chi nhánh của bạn.",
  [MSG_SAVE_FAILED]:
    "Không thể lưu suất chiếu do lỗi hệ thống. Vui lòng thử lại sau.",
  [MSG_LOAD_FAILED]: "Không thể tải danh sách suất chiếu.",
  [MSG_OPTIONS_FAILED]: "Không thể tải dữ liệu cho biểu mẫu.",
  "Your account is not assigned to a branch.":
    "Tài khoản của bạn chưa được phân công chi nhánh.",
  "Start time must be in the future.":
    "Giờ bắt đầu phải lớn hơn thời điểm hiện tại.",
  "Start time is invalid. Use HH:mm.": "Giờ bắt đầu không hợp lệ.",
  "Screening date is invalid.": "Ngày chiếu không hợp lệ.",
  "Selected movie is invalid or no longer available.":
    "Bộ phim đã chọn không hợp lệ hoặc không còn khả dụng.",
  "Selected screening room is invalid.": "Phòng chiếu đã chọn không hợp lệ.",
  "Selected screening room is not active.":
    "Phòng chiếu đã chọn không ở trạng thái hoạt động.",
  "Selected price value is invalid or no longer available.":
    "Hệ số giá đã chọn không hợp lệ hoặc không còn khả dụng.",
  "Unable to load pricing configurations.": "Không thể tải cấu hình hệ số giá.",
  "Validation failed": "Dữ liệu nhập chưa hợp lệ.",
};

const REQUIRED_VI: Record<string, string> = {
  Movie: "Vui lòng chọn bộ phim chiếu.",
  Date: "Vui lòng chọn ngày chiếu.",
  "Start time": "Vui lòng chọn giờ bắt đầu.",
  "Screening room": "Vui lòng chọn phòng chiếu.",
};

/** Translates a BE message; unknown text is returned unchanged. */
export function viMessage(message: string): string {
  const exact = VI_MESSAGES[message];
  if (exact) return exact;
  const required = /^The (.+) field is required\.$/.exec(message);
  if (required && REQUIRED_VI[required[1]]) return REQUIRED_VI[required[1]];
  return message;
}

export type ShowtimePhase = "UPCOMING" | "ONGOING" | "ENDED";

/** Derives the timing phase from the showtime's own start/end (cinema-agnostic, instant based). */
export function showtimePhase(
  showtime: Pick<ManagedShowtime, "startTime" | "endTime">,
  nowMs: number,
): ShowtimePhase {
  if (nowMs <= 0) return "UPCOMING";
  if (new Date(showtime.endTime).getTime() <= nowMs) return "ENDED";
  if (new Date(showtime.startTime).getTime() <= nowMs) return "ONGOING";
  return "UPCOMING";
}

export const DEFAULT_BASE_PRICE = 75000;

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("cinema_access_token");
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // localStorage unavailable
  }
  return {};
}

function isFieldError(value: unknown): value is FieldError {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.message === "string" && typeof item.field === "string";
}

export function hasAccessToken(): boolean {
  try {
    return Boolean(localStorage.getItem("cinema_access_token"));
  } catch {
    return false;
  }
}

/** Clears the stored session and sends the user back to the login page. */
export function redirectToLogin(): void {
  try {
    localStorage.removeItem("cinema_access_token");
    localStorage.removeItem("cinema_user");
  } catch {
    // localStorage unavailable
  }
  if (typeof window !== "undefined") window.location.replace("/login");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
  const headers: Record<string, string> = { ...authHeaders() };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (response.status === 401) redirectToLogin();
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? "Request failed.");
    const errors: FieldError[] = Array.isArray(body?.errors)
      ? body.errors.filter(isFieldError)
      : [];
    const code = typeof body?.code === "string" ? body.code : undefined;
    throw new ApiError(message, response.status, code, errors);
  }
  return body as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function fetchContext(): Promise<ManagerContext> {
  return request("/manager/showtimes/context");
}

export function fetchMovieOptions(
  keyword: string,
  page: number,
  limit: number,
): Promise<PageResult<MovieOption>> {
  return request(
    `/manager/showtimes/options/movies${toQuery({ keyword, page, limit })}`,
  );
}

export function fetchRoomOptions(): Promise<RoomOption[]> {
  return request("/manager/showtimes/options/rooms");
}

export function fetchPriceOptions(): Promise<PriceOptionField[]> {
  return request("/price-multipliers/options");
}

export function fetchShowtimes(
  params: ShowtimeQuery,
): Promise<PageResult<ManagedShowtime>> {
  return request(`/manager/showtimes${toQuery({ ...params })}`);
}

export function fetchShowtime(id: string): Promise<ManagedShowtime> {
  return request(`/manager/showtimes/${encodeURIComponent(id)}`);
}

export function createShowtime(
  payload: SaveShowtimePayload,
): Promise<ShowtimeMutation> {
  return request("/manager/showtimes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateShowtime(
  id: string,
  payload: SaveShowtimePayload,
): Promise<ShowtimeMutation> {
  return request(`/manager/showtimes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteShowtime(id: string): Promise<ShowtimeMutation> {
  return request(`/manager/showtimes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
