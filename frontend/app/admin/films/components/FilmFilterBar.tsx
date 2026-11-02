"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
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
  onCreate?: () => void;
}

const inputClass =
  "h-[38px] w-full border border-[#dad2b4] bg-[#fcfbfa] px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none transition-colors focus:border-[#da291c] focus:ring-1 focus:ring-[#da291c]";

const labelClass =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]";

export default function FilmFilterBar({
  genres,
  initial,
  onSearch,
}: Props) {
  const [filters, setFilters] = useState<FilmFilters>(initial);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(filters);
  }

  return (
    <div className="border border-[#e3e1d6] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e3e1d6] bg-[#efebdb] px-5 py-3">
        <span className="text-[13px] font-bold uppercase text-[#231f20]">
          Bộ lọc Tìm kiếm Phim
        </span>
        <span className="text-[12px] text-[#6f6247]">Toàn hệ thống</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <label className="block">
          <span className={labelClass}>Tên phim</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9d9580]" />
            <input
              type="search"
              value={filters.keyword}
              onChange={(e) =>
                setFilters({ ...filters, keyword: e.target.value })
              }
              placeholder="Nhập tên phim"
              className={`${inputClass} pl-9`}
            />
          </div>
        </label>
        <label className="block">
          <span className={labelClass}>Thể loại</span>
          <select
            value={filters.genreId}
            onChange={(e) =>
              setFilters({ ...filters, genreId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">Tất cả thể loại</option>
            {genres.map((genre) => (
              <option key={genre.genreId} value={genre.genreId}>
                {genre.genreName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Trạng thái phát hành</span>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
            className={inputClass}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-[38px] cursor-pointer items-center justify-center gap-1.5 self-end border border-[#dad2b4] bg-[#efebdb] px-5 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
        >
          <Search className="h-4 w-4" />
          Tìm kiếm
        </button>
      </form>
    </div>
  );
}
