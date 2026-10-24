"use client";

import { FormEvent, useState } from "react";
import { Genre, STATUS_LABEL } from "../api";

export interface FilmFilters {
  keyword: string;
  genreId: string;
  status: string;
}

interface Props {
  genres: Genre[];
  initial: FilmFilters;
  onSearch: (filters: FilmFilters) => void;
  onCreate: () => void;
}

const fieldClass =
  "h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main placeholder:text-text-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600";

export default function FilmFilterBar({
  genres,
  initial,
  onSearch,
  onCreate,
}: Props) {
  const [filters, setFilters] = useState<FilmFilters>(initial);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(filters);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-border-main bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text-sub">
          Tên phim
        </span>
        <input
          type="search"
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Nhập tên phim"
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text-sub">
          Thể loại
        </span>
        <select
          value={filters.genreId}
          onChange={(e) => setFilters({ ...filters, genreId: e.target.value })}
          className={fieldClass}
        >
          <option value="">Tất cả</option>
          {genres.map((genre) => (
            <option key={genre.genreId} value={genre.genreId}>
              {genre.genreName}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text-sub">
          Trạng thái
        </span>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className={fieldClass}
        >
          <option value="">Tất cả</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="h-10 self-end rounded-lg border border-border-main bg-white px-4 text-sm font-medium text-text-main transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary-600 motion-reduce:transition-none"
      >
        Tìm kiếm
      </button>
      <button
        type="button"
        onClick={onCreate}
        className="h-10 self-end rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 motion-reduce:transition-none"
      >
        Tạo phim mới
      </button>
    </form>
  );
}
