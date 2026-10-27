'use client';

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import {
  ApiError,
  CODE_ROOM_CONFLICT,
  CODE_SHOWTIME_SOLD,
  CODE_SHOWTIME_STARTED,
  createShowtime,
  DEFAULT_BASE_PRICE,
  ManagedShowtime,
  MovieChoice,
  previewEndTime,
  PriceOptionField,
  PriceSelectionPayload,
  RoomOption,
  toCinemaParts,
  toInstant,
  updateShowtime,
  viMessage,
} from '../api';
import MovieSearchSelect from './MovieSearchSelect';
import PriceMultiplierFields, {
  defaultSelections,
  priceKey,
  SavedSelection,
} from './PriceMultiplierFields';
import { trapTab, useRestoreFocus } from './dialogFocus';

interface Props {
  /** Showtime to edit; `null` creates a new one. */
  showtime: ManagedShowtime | null;
  /** Pre-filled screening date (cinema time) when creating. */
  defaultDate: string;
  branchName: string;
  rooms: RoomOption[];
  priceFields: PriceOptionField[];
  priceFieldsFailed: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** The list is stale (showtime sold / removed meanwhile). */
  onStale: () => void;
  onUnauthorized: () => void;
}

type FieldKey = 'movieId' | 'date' | 'time' | 'roomId' | 'basePrice';
type FieldErrors = Partial<Record<FieldKey, string>>;

// BE field name -> form field
const FIELD_MAP: Record<string, FieldKey> = {
  movieId: 'movieId',
  screeningDate: 'date',
  startTime: 'time',
  roomId: 'roomId',
  basePrice: 'basePrice',
};

const ROOM_STATUS_LABEL: Record<string, string> = {
  MAINTENANCE: 'Đang bảo trì',
  CLOSED: 'Đã đóng cửa',
};

const MSG_SAVE_FAILED_VI =
  'Không thể lưu suất chiếu do lỗi hệ thống. Vui lòng thử lại sau.';

function snapshotOf(showtime: ManagedShowtime): Record<string, SavedSelection> {
  const saved: Record<string, SavedSelection> = {};
  for (const item of showtime.seatPriceSelections ?? []) {
    saved[priceKey('SEAT', item.seatType)] = {
      ruleId: item.ruleId,
      multiplier: item.multiplier,
    };
  }
  for (const item of showtime.dayPriceSelections ?? []) {
    saved[priceKey('DAY', item.dayType)] = {
      ruleId: item.ruleId,
      multiplier: item.multiplier,
    };
  }
  return saved;
}

const inputClass = (invalid: boolean) =>
  `w-full h-[42px] px-3 border bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 ${
    invalid ? 'border-[#da291c]' : 'border-[#dad2b4]'
  }`;

const labelClass = 'block text-[12px] font-bold uppercase text-[#231f20] mb-1';
const errorClass = 'mt-1 text-[12px] font-semibold text-[#da291c]';

export default function ShowtimeFormModal({
  showtime,
  defaultDate,
  branchName,
  rooms,
  priceFields,
  priceFieldsFailed,
  onClose,
  onSaved,
  onStale,
  onUnauthorized,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  const editing = showtime !== null;

  const [movie, setMovie] = useState<MovieChoice | null>(() =>
    showtime
      ? {
          movieId: showtime.movieId,
          movieName: showtime.movieName,
          duration: showtime.movieDuration,
          posterUrl: showtime.posterUrl,
        }
      : null,
  );
  const [roomId, setRoomId] = useState(
    () =>
      showtime?.roomId ??
      rooms.find((r) => r.roomStatus === 'AVAILABLE')?.roomId ??
      '',
  );
  const [date, setDate] = useState(() =>
    showtime ? toCinemaParts(showtime.startTime).date : defaultDate,
  );
  const [time, setTime] = useState(() =>
    showtime ? toCinemaParts(showtime.startTime).time : '19:30',
  );
  const [basePrice, setBasePrice] = useState(() =>
    String(showtime ? showtime.basePrice : DEFAULT_BASE_PRICE),
  );
  const [saved] = useState(() => (showtime ? snapshotOf(showtime) : {}));
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    if (!showtime) return defaultSelections(priceFields);
    const initial: Record<string, string> = {};
    for (const [key, value] of Object.entries(snapshotOf(showtime))) {
      if (value.ruleId) initial[key] = value.ruleId;
    }
    return initial;
  });
  const [priceTouched, setPriceTouched] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isConflict, setIsConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useRestoreFocus();

  useEffect(() => {
    rootRef.current
      ?.querySelector<HTMLElement>('input:not([disabled])')
      ?.focus();
  }, []);

  const endPreview = movie ? previewEndTime(date, time, movie.duration) : null;

  function clearError(key: FieldKey) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!submitting) onClose();
      return;
    }
    trapTab(event, rootRef.current);
  }

  function buildSelections(): PriceSelectionPayload[] {
    const result: PriceSelectionPayload[] = [];
    for (const field of priceFields) {
      const ruleId = selections[priceKey(field.group, field.fieldKey)];
      if (ruleId) {
        result.push({ group: field.group, fieldKey: field.fieldKey, ruleId });
      }
    }
    return result;
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!movie) next.movieId = 'Vui lòng chọn bộ phim chiếu.';
    if (!roomId) next.roomId = 'Vui lòng chọn phòng chiếu.';
    if (!date) next.date = 'Vui lòng chọn ngày chiếu.';
    if (!time) next.time = 'Vui lòng chọn giờ bắt đầu.';

    // Same rule as the server: only enforce "future" when the schedule changes
    const original = showtime ? toCinemaParts(showtime.startTime) : null;
    const scheduleChanged =
      !showtime ||
      date !== original?.date ||
      time !== original?.time ||
      roomId !== showtime.roomId;
    if (scheduleChanged && date && time) {
      const today = toCinemaParts(new Date()).date;
      if (date < today) {
        next.date = 'Ngày chiếu không hợp lệ. Không thể chọn ngày trong quá khứ.';
      } else if (date === today) {
        const start = toInstant(date, time);
        if (start && start.getTime() <= Date.now()) {
          next.time = 'Giờ bắt đầu phải lớn hơn thời điểm hiện tại.';
        }
      }
    }

    const price = Number(basePrice);
    if (basePrice.trim() === '' || Number.isNaN(price) || price < 0) {
      next.basePrice = 'Giá vé cơ bản phải là số không âm hợp lệ.';
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;

    const next = validate();
    setErrors(next);
    setFormError('');
    setIsConflict(false);
    if (Object.keys(next).length > 0 || !movie) return;

    const payload = {
      movieId: movie.movieId,
      screeningDate: date,
      startTime: time,
      roomId,
      basePrice: Number(basePrice),
      // Edit: only send when a dropdown changed, so the server keeps the old snapshot
      ...(!editing || priceTouched
        ? { priceSelections: buildSelections() }
        : {}),
    };

    submitLock.current = true;
    setSubmitting(true);
    try {
      if (showtime) {
        await updateShowtime(showtime.showtimeId, payload);
        onSaved('Cập nhật suất chiếu thành công.');
      } else {
        await createShowtime(payload);
        onSaved('Tạo suất chiếu mới thành công.');
      }
    } catch (err) {
      handleSaveError(err);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function handleSaveError(err: unknown) {
    if (!(err instanceof ApiError)) {
      setFormError(MSG_SAVE_FAILED_VI);
      return;
    }
    if (err.status === 401) {
      onUnauthorized();
      return;
    }
    if (err.status === 409 && err.code === CODE_ROOM_CONFLICT) {
      setIsConflict(true);
      setFormError(viMessage(err.message));
      return;
    }
    if (
      err.status === 409 &&
      (err.code === CODE_SHOWTIME_SOLD || err.code === CODE_SHOWTIME_STARTED)
    ) {
      setFormError(viMessage(err.message));
      onStale();
      return;
    }
    if (err.status === 404) {
      setFormError(viMessage(err.message));
      onStale();
      return;
    }
    if (err.status >= 500) {
      setFormError(MSG_SAVE_FAILED_VI);
      return;
    }
    const mapped: FieldErrors = {};
    for (const item of err.errors) {
      let key = FIELD_MAP[item.field];
      if (key === 'time' && date < toCinemaParts(new Date()).date) key = 'date';
      if (key && !mapped[key]) mapped[key] = viMessage(item.message);
    }
    if (Object.keys(mapped).length > 0) {
      setErrors(mapped);
      return;
    }
    // Field-less 400s (e.g. invalid price selection) and 403s
    setFormError(viMessage(err.message) || MSG_SAVE_FAILED_VI);
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="showtime-form-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-[640px] border-2 border-[#231f20] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-[#c1b687] bg-[#231f20] px-6 py-4 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
              {branchName}
            </p>
            <h2
              id="showtime-form-title"
              className="text-[18px] font-bold uppercase"
            >
              {editing ? 'Cập nhật Suất chiếu' : 'Tạo Suất chiếu mới'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            className="cursor-pointer text-[#c1b687] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 p-6">
          {formError && (
            <div
              role="alert"
              className="border-l-4 border-[#da291c] bg-[#fef2f2] p-3.5 text-[13px] text-[#b91c1c]"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#da291c]" />
                <div className="space-y-1">
                  {isConflict && (
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#da291c]">
                      Trùng lịch phòng chiếu
                    </p>
                  )}
                  <p className="font-bold">{formError}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="showtime-movie" className={labelClass}>
              Bộ phim chiếu <span className="text-[#da291c]">*</span>
            </label>
            <MovieSearchSelect
              id="showtime-movie"
              value={movie}
              invalid={Boolean(errors.movieId)}
              disabled={submitting}
              onChange={(next) => {
                setMovie(next);
                clearError('movieId');
              }}
            />
            {errors.movieId && <p className={errorClass}>{errors.movieId}</p>}
          </div>

          <div>
            <label htmlFor="showtime-room" className={labelClass}>
              Phòng chiếu tại Chi nhánh{' '}
              <span className="text-[#da291c]">*</span>
            </label>
            <select
              id="showtime-room"
              value={roomId}
              disabled={submitting}
              onChange={(e) => {
                setRoomId(e.target.value);
                clearError('roomId');
              }}
              className={inputClass(Boolean(errors.roomId))}
            >
              <option value="">-- Chọn phòng chiếu --</option>
              {rooms.map((room) => {
                const available = room.roomStatus === 'AVAILABLE';
                return (
                  <option
                    key={room.roomId}
                    value={room.roomId}
                    disabled={!available}
                  >
                    {room.roomName}
                    {!available
                      ? ` (${ROOM_STATUS_LABEL[room.roomStatus] ?? 'Không khả dụng'} - Không thể chọn)`
                      : ''}
                  </option>
                );
              })}
            </select>
            {errors.roomId && <p className={errorClass}>{errors.roomId}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="showtime-date" className={labelClass}>
                Ngày chiếu <span className="text-[#da291c]">*</span>
              </label>
              <input
                id="showtime-date"
                type="date"
                value={date}
                disabled={submitting}
                onChange={(e) => {
                  setDate(e.target.value);
                  clearError('date');
                }}
                className={inputClass(Boolean(errors.date))}
              />
              {errors.date && <p className={errorClass}>{errors.date}</p>}
            </div>
            <div>
              <label htmlFor="showtime-time" className={labelClass}>
                Giờ bắt đầu chiếu <span className="text-[#da291c]">*</span>
              </label>
              <input
                id="showtime-time"
                type="time"
                value={time}
                disabled={submitting}
                onChange={(e) => {
                  setTime(e.target.value);
                  clearError('time');
                }}
                className={inputClass(Boolean(errors.time))}
              />
              {errors.time && <p className={errorClass}>{errors.time}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between border border-[#dad2b4] bg-[#efebdb] p-3.5">
            <div className="flex items-center gap-2 text-[12px] text-[#6f6247]">
              <Clock className="h-4 w-4 shrink-0 text-[#da291c]" />
              <span>
                Giờ kết thúc dự kiến (tự động cộng{' '}
                <strong>{movie?.duration ?? 0} phút</strong> thời lượng phim):
              </span>
            </div>
            <span className="text-[14px] font-bold text-[#231f20]">
              {endPreview
                ? `${endPreview.time}${endPreview.nextDay ? ' (+1 ngày)' : ''}`
                : '--:--'}
            </span>
          </div>

          <div>
            <label htmlFor="showtime-price" className={labelClass}>
              Giá vé cơ bản (VNĐ) <span className="text-[#da291c]">*</span>
            </label>
            <input
              id="showtime-price"
              type="number"
              min={0}
              step={5000}
              value={basePrice}
              disabled={submitting}
              onChange={(e) => {
                setBasePrice(e.target.value);
                clearError('basePrice');
              }}
              className={inputClass(Boolean(errors.basePrice))}
            />
            {errors.basePrice && (
              <p className={errorClass}>{errors.basePrice}</p>
            )}
          </div>

          <PriceMultiplierFields
            fields={priceFields}
            selections={selections}
            saved={saved}
            creating={!editing}
            disabled={submitting || priceFieldsFailed}
            onChange={(key, ruleId) => {
              setPriceTouched(true);
              setSelections((prev) => ({ ...prev, [key]: ruleId }));
            }}
          />
          {priceFieldsFailed && (
            <p className="text-[12px] font-semibold text-[#da291c]">
              Không thể tải cấu hình hệ số giá.{' '}
              {editing
                ? 'Hệ số hiện tại của suất chiếu sẽ được giữ nguyên.'
                : 'Suất chiếu sẽ được tạo với hệ số 1.0x.'}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[#e3e1d6] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-[40px] cursor-pointer border border-[#dad2b4] bg-[#efebdb] px-5 text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] disabled:opacity-60"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-[40px] cursor-pointer bg-[#da291c] px-6 text-[13px] font-bold text-white hover:bg-[#b82116] disabled:opacity-60"
            >
              {submitting
                ? 'Đang kiểm tra & lưu...'
                : editing
                  ? 'Lưu cập nhật'
                  : 'Xác nhận Tạo suất chiếu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
