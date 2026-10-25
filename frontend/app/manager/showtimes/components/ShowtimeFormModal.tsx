"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ApiError,
  CODE_ROOM_CONFLICT,
  CODE_SHOWTIME_SOLD,
  createShowtime,
  fetchShowtime,
  ManagedShowtime,
  MovieChoice,
  MSG03,
  MSG04,
  MSG02,
  MSG_LOAD_FAILED,
  MSG_NOT_FOUND,
  MSG_SAVE_FAILED,
  msg01,
  PriceOptionField,
  previewEndTime,
  PriceSelectionPayload,
  RoomOption,
  toCinemaParts,
  updateShowtime,
} from "../api";
import ConflictDialog from "./ConflictDialog";
import { trapTab, useRestoreFocus } from "./dialogFocus";
import MovieCombobox from "./MovieCombobox";
import PriceMultiplierSelects, {
  priceKey,
  SavedSelection,
} from "./PriceMultiplierSelects";

interface Props {
  /** Showtime id to edit; `null` creates a new showtime. */
  showtimeId: string | null;
  rooms: RoomOption[];
  priceFields: PriceOptionField[];
  priceFieldsFailed: boolean;
  onClose: () => void;
  /** Called after a successful save with MSG02. */
  onSaved: (message: string) => void;
  /** The list is stale (e.g. showtime got tickets / was removed). */
  onStale: () => void;
  onUnauthorized: () => void;
}

type FieldKey = "movieId" | "screeningDate" | "startTime" | "roomId";
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_KEYS: FieldKey[] = [
  "movieId",
  "screeningDate",
  "startTime",
  "roomId",
];

const ROOM_STATUS_LABEL: Record<string, string> = {
  MAINTENANCE: "Bảo trì",
  CLOSED: "Đóng cửa",
};

const inputClass = (invalid: boolean) =>
  `h-10 w-full rounded-lg border bg-white px-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-70 ${
    invalid
      ? "border-primary-600 focus:border-primary-600 focus:ring-primary-600"
      : "border-border-main focus:border-primary-600 focus:ring-primary-600"
  }`;

function isFieldKey(value: string): value is FieldKey {
  return (FIELD_KEYS as string[]).includes(value);
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function snapshotOf(showtime: ManagedShowtime): Record<string, SavedSelection> {
  const saved: Record<string, SavedSelection> = {};
  for (const item of showtime.seatPriceSelections ?? []) {
    saved[priceKey("SEAT", item.seatType)] = {
      ruleId: item.ruleId,
      multiplier: item.multiplier,
    };
  }
  for (const item of showtime.dayPriceSelections ?? []) {
    saved[priceKey("DAY", item.dayType)] = {
      ruleId: item.ruleId,
      multiplier: item.multiplier,
    };
  }
  return saved;
}

interface FormProps extends Omit<Props, "showtimeId"> {
  showtime: ManagedShowtime | null;
}

function ShowtimeForm({
  showtime,
  rooms,
  priceFields,
  priceFieldsFailed,
  onClose,
  onSaved,
  onStale,
  onUnauthorized,
}: FormProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);

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
  const [date, setDate] = useState(() =>
    showtime ? toCinemaParts(showtime.startTime).date : "",
  );
  const [time, setTime] = useState(() =>
    showtime ? toCinemaParts(showtime.startTime).time : "",
  );
  const [roomId, setRoomId] = useState(showtime?.roomId ?? "");
  const [saved] = useState(() => (showtime ? snapshotOf(showtime) : {}));
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, value] of Object.entries(saved)) {
      if (value.ruleId) initial[key] = value.ruleId;
    }
    return initial;
  });
  const [priceTouched, setPriceTouched] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [conflict, setConflict] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useRestoreFocus();

  useEffect(() => {
    const first = rootRef.current?.querySelector<HTMLElement>(
      "input:not([disabled])",
    );
    first?.focus();
  }, []);

  const endPreview = movie ? previewEndTime(date, time, movie.duration) : null;
  const editing = showtime !== null;

  function clearError(key: FieldKey) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;

    const next: FieldErrors = {};
    if (!movie) next.movieId = msg01("Movie");
    if (!date) next.screeningDate = msg01("Date");
    if (!time) next.startTime = msg01("Start time");
    if (!roomId) next.roomId = msg01("Screening room");
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length > 0 || !movie) return;

    const payload = {
      movieId: movie.movieId,
      screeningDate: date,
      startTime: time,
      roomId,
      // Edit: only send when the user changed a dropdown, so the server keeps the old snapshot.
      ...(!editing || priceTouched
        ? { priceSelections: buildSelections() }
        : {}),
    };

    submitLock.current = true;
    setSubmitting(true);
    try {
      const result = showtime
        ? await updateShowtime(showtime.showtimeId, payload)
        : await createShowtime(payload);
      onSaved(result.message || MSG02);
    } catch (err) {
      handleSaveError(err);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function handleSaveError(err: unknown) {
    if (!(err instanceof ApiError)) {
      setFormError(MSG_SAVE_FAILED);
      return;
    }
    if (err.status === 401) {
      onUnauthorized();
      return;
    }
    if (err.status === 409 && err.code === CODE_ROOM_CONFLICT) {
      setConflict(err.message || MSG03);
      return;
    }
    if (err.status === 409 && err.code === CODE_SHOWTIME_SOLD) {
      setFormError(err.message || MSG04);
      onStale();
      return;
    }
    if (err.status === 404) {
      setFormError(MSG_NOT_FOUND);
      onStale();
      return;
    }
    if (err.status >= 500) {
      setFormError(MSG_SAVE_FAILED);
      return;
    }
    const mapped: FieldErrors = {};
    for (const item of err.errors) {
      if (isFieldKey(item.field) && !mapped[item.field]) {
        mapped[item.field] = item.message;
      }
    }
    if (Object.keys(mapped).length > 0) {
      setErrors(mapped);
      return;
    }
    // Includes the field-less 400s (e.g. invalid price selection) and 403s.
    setFormError(err.message || MSG_SAVE_FAILED);
  }

  const errText = "mt-1 text-xs text-status-danger";

  return (
    <>
      <div
        ref={rootRef}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="showtime-form-title"
        onKeyDown={handleKeyDown}
      >
        <form
          noValidate
          onSubmit={handleSubmit}
          className="w-full max-w-2xl rounded-xl bg-surface p-4 shadow-card sm:p-6"
        >
          <h2
            id="showtime-form-title"
            className="text-lg font-bold text-text-main"
          >
            {editing ? "Sửa suất chiếu" : "Tạo suất chiếu"}
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="sf-movie"
                className="mb-1 block text-sm font-medium text-text-sub"
              >
                Phim *
              </label>
              <MovieCombobox
                id="sf-movie"
                value={movie}
                invalid={!!errors.movieId}
                describedBy={errors.movieId ? "sf-err-movie" : "sf-movie-info"}
                disabled={submitting}
                onChange={(next) => {
                  setMovie(next);
                  clearError("movieId");
                }}
              />
              {movie && (
                <p id="sf-movie-info" className="mt-1 text-xs text-text-muted">
                  Thời lượng: {movie.duration} phút
                </p>
              )}
              {errors.movieId && (
                <p id="sf-err-movie" className={errText}>
                  {errors.movieId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sf-date"
                className="mb-1 block text-sm font-medium text-text-sub"
              >
                Ngày chiếu *
              </label>
              <input
                id="sf-date"
                type="date"
                value={date}
                disabled={submitting}
                onChange={(e) => {
                  setDate(e.target.value);
                  clearError("screeningDate");
                }}
                aria-invalid={!!errors.screeningDate}
                aria-describedby={errors.screeningDate ? "sf-err-date" : undefined}
                className={inputClass(!!errors.screeningDate)}
              />
              {errors.screeningDate && (
                <p id="sf-err-date" className={errText}>
                  {errors.screeningDate}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sf-time"
                className="mb-1 block text-sm font-medium text-text-sub"
              >
                Giờ bắt đầu *
              </label>
              <input
                id="sf-time"
                type="time"
                step={300}
                value={time}
                disabled={submitting}
                onChange={(e) => {
                  setTime(e.target.value);
                  clearError("startTime");
                }}
                aria-invalid={!!errors.startTime}
                aria-describedby={errors.startTime ? "sf-err-time" : undefined}
                className={inputClass(!!errors.startTime)}
              />
              {errors.startTime && (
                <p id="sf-err-time" className={errText}>
                  {errors.startTime}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sf-room"
                className="mb-1 block text-sm font-medium text-text-sub"
              >
                Phòng chiếu *
              </label>
              <select
                id="sf-room"
                value={roomId}
                disabled={submitting}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  clearError("roomId");
                }}
                aria-invalid={!!errors.roomId}
                aria-describedby={errors.roomId ? "sf-err-room" : undefined}
                className={inputClass(!!errors.roomId)}
              >
                <option value="">Chọn phòng chiếu</option>
                {rooms.map((room) => {
                  const unavailable = room.roomStatus !== "AVAILABLE";
                  const label = ROOM_STATUS_LABEL[room.roomStatus];
                  return (
                    <option
                      key={room.roomId}
                      value={room.roomId}
                      disabled={unavailable}
                    >
                      {room.roomName}
                      {unavailable ? ` (${label ?? "Không khả dụng"})` : ""}
                    </option>
                  );
                })}
              </select>
              {errors.roomId && (
                <p id="sf-err-room" className={errText}>
                  {errors.roomId}
                </p>
              )}
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-text-sub">
                Giờ kết thúc dự kiến
              </span>
              <p
                aria-live="polite"
                className="flex h-10 items-center rounded-lg bg-surface-muted px-3 text-sm text-text-main"
              >
                {endPreview
                  ? `${endPreview.time}${endPreview.nextDay ? " (hôm sau)" : ""}`
                  : "-"}
              </p>
            </div>

            <PriceMultiplierSelects
              fields={priceFields}
              selections={selections}
              saved={saved}
              disabled={submitting}
              onChange={(key, ruleId) => {
                setPriceTouched(true);
                setSelections((prev) => ({ ...prev, [key]: ruleId }));
              }}
            />
            {priceFieldsFailed && (
              <p role="alert" className="text-xs text-status-danger sm:col-span-2">
                Không thể tải danh sách hệ số giá. Suất chiếu sẽ dùng hệ số 1.0x
                {editing ? " hoặc giữ nguyên hệ số đã lưu" : ""}.
              </p>
            )}
          </div>

          {formError && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-danger"
            >
              {formError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 rounded-lg border border-border-main bg-white px-4 text-sm font-medium text-text-main transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              aria-disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-70 motion-reduce:transition-none"
            >
              {submitting && <Spinner />}
              {submitting ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
      {conflict && (
        <ConflictDialog message={conflict} onClose={() => setConflict("")} />
      )}
    </>
  );
}

export default function ShowtimeFormModal({ showtimeId, ...rest }: Props) {
  const { onClose, onStale, onUnauthorized } = rest;
  const [showtime, setShowtime] = useState<ManagedShowtime | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(showtimeId !== null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (showtimeId === null) return;
    let cancelled = false;
    fetchShowtime(showtimeId)
      .then((result) => {
        if (cancelled) return;
        setShowtime(result);
        setLoadError("");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized();
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setLoadError(MSG_NOT_FOUND);
          onStale();
          return;
        }
        setLoadError(MSG_LOAD_FAILED);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showtimeId, attempt, onStale, onUnauthorized]);

  if (showtimeId === null) {
    return <ShowtimeForm showtime={null} {...rest} />;
  }
  if (showtime) {
    return <ShowtimeForm showtime={showtime} {...rest} />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sửa suất chiếu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-4 shadow-card sm:p-6">
        {loading && (
          <p role="status" className="text-sm text-text-sub">
            Đang tải suất chiếu...
          </p>
        )}
        {!loading && loadError && (
          <p role="alert" className="text-sm text-status-danger">
            {loadError}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-3">
          {!loading && loadError !== MSG_NOT_FOUND && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setLoadError("");
                setAttempt((n) => n + 1);
              }}
              className="h-10 rounded-lg border border-border-main bg-white px-4 text-sm font-medium text-text-main hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              Thử lại
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="h-10 rounded-lg border border-border-main bg-white px-4 text-sm font-medium text-text-main hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
