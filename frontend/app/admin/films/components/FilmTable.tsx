"use client";

import { useState } from "react";
import {
  Genre,
  MSG01,
  Movie,
  MovieStatus,
  PageResult,
  STATUS_LABEL,
} from "../api";

interface Props {
  data: PageResult<Movie> | null;
  genres: Genre[];
  loading: boolean;
  error: string;
  onPageChange: (page: number) => void;
  onDeactivate: (movie: Movie) => void;
}

const STATUS_BADGE: Record<MovieStatus, string> = {
  NOW_SHOWING: "bg-primary-100 text-primary-700 border-primary-100",
  COMING_SOON: "bg-amber-50 text-amber-800 border-amber-200",
  ENDED: "bg-slate-100 text-slate-700 border-slate-200",
};

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

const th =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-sub";
const td = "px-4 py-3.5 text-sm text-text-main";

function PosterCell({ movie }: { movie: Movie }) {
  const [failedUrl, setFailedUrl] = useState("");
  const showImage = Boolean(movie.posterUrl && failedUrl !== movie.posterUrl);

  return showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={movie.posterUrl}
      alt={`Poster ${movie.movieName}`}
      loading="lazy"
      onError={() => setFailedUrl(movie.posterUrl ?? "")}
      className="h-16 w-11 rounded object-cover"
    />
  ) : (
    <div
      role="img"
      aria-label={`Chưa có poster ${movie.movieName}`}
      className="flex h-16 w-11 items-center justify-center rounded bg-surface-muted text-xs text-text-muted"
    >
      N/A
    </div>
  );
}

export default function FilmTable({
  data,
  genres,
  loading,
  error,
  onPageChange,
  onDeactivate,
}: Props) {
  const genreName = (id: string) =>
    genres.find((g) => g.genreId === id)?.genreName ?? id;
  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border-main bg-surface">
        <table className="min-w-full">
          <thead className="bg-surface-muted">
            <tr>
              <th className={th}>Poster</th>
              <th className={th}>Tên phim</th>
              <th className={th}>Thể loại</th>
              <th className={th}>Thời lượng (phút)</th>
              <th className={th}>Ngày công chiếu</th>
              <th className={th}>Trạng thái</th>
              <th className={th}>Kích hoạt</th>
              <th className={th}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border-main">
                  <td colSpan={8} className="px-4 py-3.5">
                    <div className="h-6 animate-pulse rounded bg-surface-muted motion-reduce:animate-none" />
                  </td>
                </tr>
              ))}
            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-text-sub"
                >
                  {MSG01}
                </td>
              </tr>
            )}
            {!loading &&
              items.map((movie) => (
                <tr
                  key={movie.movieId}
                  className="border-b border-border-main transition-colors hover:bg-slate-50 motion-reduce:transition-none"
                >
                  <td className={td}>
                    <PosterCell movie={movie} />
                  </td>
                  <td className={`${td} font-medium`}>{movie.movieName}</td>
                  <td className={td}>
                    {movie.genreIds.map(genreName).join(", ") || "-"}
                  </td>
                  <td className={td}>{movie.duration}</td>
                  <td className={td}>
                    {movie.releaseDate
                      ? dateFormat.format(new Date(movie.releaseDate))
                      : "-"}
                  </td>
                  <td className={td}>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[movie.status]}`}
                    >
                      {STATUS_LABEL[movie.status]}
                    </span>
                  </td>
                  <td className={td}>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        movie.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {movie.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                    </span>
                  </td>
                  <td className={td}>
                    <button
                      type="button"
                      disabled={!movie.isActive}
                      onClick={() => onDeactivate(movie)}
                      className="h-9 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-status-danger transition-colors hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                    >
                      Vô hiệu hóa
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-sub">
          <span>
            Trang {data.page}/{data.totalPages} - Tổng{" "}
            {data.total.toLocaleString("vi-VN")} phim
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
              className="h-10 rounded-lg border border-border-main bg-white px-4 text-text-main hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() => onPageChange(data.page + 1)}
              className="h-10 rounded-lg border border-border-main bg-white px-4 text-text-main hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
