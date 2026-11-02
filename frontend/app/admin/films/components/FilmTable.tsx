"use client";

import { useState } from "react";
import { Ban, CircleCheck, CircleOff } from "lucide-react";
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
  NOW_SHOWING: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  COMING_SOON: "border-[#fde68a] bg-[#fef3c7] text-[#b45309]",
  ENDED: "border-[#d1d5db] bg-[#f3f4f6] text-[#6b7280]",
};

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

const th =
  "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6f6247]";
const td = "px-4 py-3.5 text-[13px] text-[#231f20]";

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
      className="h-16 w-11 rounded border border-[#dad2b4] object-cover"
    />
  ) : (
    <div
      role="img"
      aria-label={`Chưa có poster ${movie.movieName}`}
      className="flex h-16 w-11 items-center justify-center rounded border border-[#dad2b4] bg-[#efebdb] text-xs font-bold text-[#6f6247]"
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
          className="border border-[#da291c] bg-[#fef2f2] px-4 py-3 text-[13px] font-bold text-[#da291c]"
        >
          {error}
        </div>
      )}
      <div className="overflow-hidden border border-[#e3e1d6] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-[#dad2b4] bg-[#efebdb]">
              <tr>
                <th className={th}>Poster</th>
                <th className={th}>Tên phim</th>
                <th className={th}>Thể loại</th>
                <th className={th}>Thời lượng (phút)</th>
                <th className={th}>Ngày công chiếu</th>
                <th className={`${th} !text-center`}>Trạng thái</th>
                <th className={`${th} !text-center`}>Kích hoạt</th>
                <th className={`${th} !text-center`}>Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eee4]">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#f0eee4]">
                    <td colSpan={8} className="px-4 py-3.5">
                      <div className="h-6 animate-pulse rounded bg-[#efebdb] motion-reduce:animate-none" />
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-[13px] text-[#666]"
                  >
                    {MSG01}
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((movie) => (
                  <tr
                    key={movie.movieId}
                    className="border-b border-[#f0eee4] transition-colors hover:bg-[#fcfbfa] motion-reduce:transition-none"
                  >
                    <td className={td}>
                      <PosterCell movie={movie} />
                    </td>
                    <td className={`${td} font-bold`}>{movie.movieName}</td>
                    <td className={td}>
                      {movie.genreIds.map(genreName).join(", ") || "-"}
                    </td>
                    <td className={td}>{movie.duration}</td>
                    <td className={td}>
                      {movie.releaseDate
                        ? dateFormat.format(new Date(movie.releaseDate))
                        : "-"}
                    </td>
                    <td className={`${td} text-center`}>
                      <span
                        className={`inline-flex items-center justify-center border px-2.5 py-0.5 text-center text-[11px] font-bold ${STATUS_BADGE[movie.status]}`}
                      >
                        {STATUS_LABEL[movie.status]}
                      </span>
                    </td>
                    <td className={`${td} text-center`}>
                      <span
                        title={movie.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                        role="img"
                        aria-label={
                          movie.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"
                        }
                        className={`inline-flex h-8 w-8 items-center justify-center border ${movie.isActive
                            ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
                            : "border-[#d1d5db] bg-[#f3f4f6] text-[#6b7280]"
                          }`}
                      >
                        {movie.isActive ? (
                          <CircleCheck className="h-4 w-4" />
                        ) : (
                          <CircleOff className="h-4 w-4" />
                        )}
                      </span>
                    </td>
                    <td className={`${td} text-center`}>
                      <button
                        type="button"
                        disabled={!movie.isActive}
                        onClick={() => onDeactivate(movie)}
                        title="Vô hiệu hóa"
                        aria-label={`Vô hiệu hóa ${movie.movieName}`}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center border border-[#fecaca] bg-white text-[#da291c] transition-colors hover:bg-[#fef2f2] focus-visible:ring-1 focus-visible:ring-[#da291c] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e1d6] bg-[#fcfbfa] px-4 py-3 text-[13px] text-[#666]">
            <span>
              Trang {data.page}/{data.totalPages} - Tổng{" "}
              {data.total.toLocaleString("vi-VN")} phim
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => onPageChange(data.page - 1)}
                className="inline-flex h-[34px] cursor-pointer items-center border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => onPageChange(data.page + 1)}
                className="inline-flex h-[34px] cursor-pointer items-center border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
