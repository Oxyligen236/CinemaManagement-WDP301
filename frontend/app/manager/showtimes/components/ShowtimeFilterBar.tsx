"use client";

import { MovieOption, RoomOption } from "../api";

export interface ShowtimeFilters {
  date: string;
  movieId: string;
  roomId: string;
  includePast: boolean;
}

interface Props {
  filters: ShowtimeFilters;
  movies: MovieOption[];
  rooms: RoomOption[];
  onChange: (filters: ShowtimeFilters) => void;
  onCreate: () => void;
}

const fieldClass =
  "h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main placeholder:text-text-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600";

export default function ShowtimeFilterBar({
  filters,
  movies,
  rooms,
  onChange,
  onCreate,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border-main bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_1fr_auto_auto]">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text-sub">
          Ngày chiếu
        </span>
        <input
          type="date"
          value={filters.date}
          onChange={(e) => onChange({ ...filters, date: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text-sub">
          Phim
        </span>
        <select
          value={filters.movieId}
          onChange={(e) => onChange({ ...filters, movieId: e.target.value })}
          className={fieldClass}
        >
          <option value="">Tất cả</option>
          {movies.map((movie) => (
            <option key={movie.movieId} value={movie.movieId}>
              {movie.movieName}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text-sub">
          Phòng chiếu
        </span>
        <select
          value={filters.roomId}
          onChange={(e) => onChange({ ...filters, roomId: e.target.value })}
          className={fieldClass}
        >
          <option value="">Tất cả</option>
          {rooms.map((room) => (
            <option key={room.roomId} value={room.roomId}>
              {room.roomName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex h-10 items-center gap-2 self-end text-sm text-text-main">
        <input
          type="checkbox"
          checked={filters.includePast}
          onChange={(e) =>
            onChange({ ...filters, includePast: e.target.checked })
          }
          className="h-4 w-4 accent-primary-600"
        />
        Hiển thị cả suất đã qua
      </label>
      <button
        type="button"
        onClick={onCreate}
        className="h-10 self-end rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 motion-reduce:transition-none"
      >
        Tạo suất chiếu
      </button>
    </div>
  );
}
