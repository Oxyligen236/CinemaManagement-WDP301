"use client";

import { useState } from "react";
import {
  formatDate,
  formatMultiplier,
  formatTime,
  ManagedShowtime,
  MSG04,
  MSG05,
  PageResult,
} from "../api";

interface Props {
  data: PageResult<ManagedShowtime> | null;
  loading: boolean;
  /** Reference instant for the "Sắp chiếu / Đang chiếu / Đã chiếu" badge. */
  now: number;
  onPageChange: (page: number) => void;
  onEdit: (showtime: ManagedShowtime) => void;
  onDelete: (showtime: ManagedShowtime) => void;
}

const COLUMNS = 7;

const th =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-sub";
const td = "px-4 py-3.5 text-sm text-text-main";

const badgeBase =
  "inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium";

const TITLE: Record<string, string> = {
  VIP: "VIP",
  COUPLE: "Couple",
  WEEKEND: "Cuối tuần",
  HOLIDAY: "Ngày lễ",
};

function runStatus(showtime: ManagedShowtime, now: number) {
  if (now < new Date(showtime.startTime).getTime()) {
    return {
      label: "Sắp chiếu",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (now < new Date(showtime.endTime).getTime()) {
    return {
      label: "Đang chiếu",
      className: "border-primary-100 bg-primary-100 text-primary-700",
    };
  }
  return {
    label: "Đã chiếu",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
}

function multiplierBadges(showtime: ManagedShowtime): string[] {
  const seats = (showtime.seatPriceSelections ?? []).map((item) => ({
    name: TITLE[item.seatType] ?? item.seatType,
    multiplier: item.multiplier,
  }));
  const days = (showtime.dayPriceSelections ?? []).map((item) => ({
    name: TITLE[item.dayType] ?? item.dayType,
    multiplier: item.multiplier,
  }));
  return [...seats, ...days]
    .filter((item) => item.multiplier > 1)
    .map((item) => `${item.name} x${formatMultiplier(item.multiplier)}`);
}

function Poster({ showtime }: { showtime: ManagedShowtime }) {
  const [failedUrl, setFailedUrl] = useState("");
  const showImage = Boolean(
    showtime.posterUrl && failedUrl !== showtime.posterUrl,
  );
  return showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={showtime.posterUrl}
      alt={`Poster ${showtime.movieName}`}
      loading="lazy"
      onError={() => setFailedUrl(showtime.posterUrl ?? "")}
      className="h-14 w-10 shrink-0 rounded object-cover"
    />
  ) : (
    <div
      role="img"
      aria-label={`Chưa có poster ${showtime.movieName}`}
      className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-surface-muted text-xs text-text-muted"
    >
      N/A
    </div>
  );
}

const actionBase =
  "h-9 rounded-lg border bg-white px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 motion-reduce:transition-none";

export default function ShowtimeTable({
  data,
  loading,
  now,
  onPageChange,
  onEdit,
  onDelete,
}: Props) {
  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border-main bg-surface">
        <table className="min-w-full">
          <thead className="bg-surface-muted">
            <tr>
              <th className={th}>Phim</th>
              <th className={th}>Phòng</th>
              <th className={th}>Ngày chiếu</th>
              <th className={th}>Giờ chiếu</th>
              <th className={th}>Hệ số áp dụng</th>
              <th className={th}>Trạng thái</th>
              <th className={th}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border-main">
                  <td colSpan={COLUMNS} className="px-4 py-3.5">
                    <div className="h-6 animate-pulse rounded bg-surface-muted motion-reduce:animate-none" />
                  </td>
                </tr>
              ))}
            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS}
                  className="px-4 py-12 text-center text-sm text-text-sub"
                >
                  Chưa có suất chiếu nào phù hợp.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((showtime) => {
                const status = runStatus(showtime, now);
                const badges = multiplierBadges(showtime);
                const sold = showtime.hasSoldTickets;
                return (
                  <tr
                    key={showtime.showtimeId}
                    className="border-b border-border-main transition-colors hover:bg-slate-50 motion-reduce:transition-none"
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Poster showtime={showtime} />
                        <div>
                          <p className="font-medium">{showtime.movieName}</p>
                          <p className="text-xs text-text-muted">
                            {showtime.movieDuration} phút
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={td}>{showtime.roomName}</td>
                    <td className={td}>{formatDate(showtime.startTime)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatTime(showtime.startTime)} -{" "}
                      {formatTime(showtime.endTime)}
                    </td>
                    <td className={td}>
                      {badges.length === 0 ? (
                        <span className="text-text-muted">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {badges.map((text) => (
                            <span
                              key={text}
                              className={`${badgeBase} border-slate-200 bg-slate-100 text-slate-700`}
                            >
                              {text}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`${badgeBase} ${status.className}`}>
                          {status.label}
                        </span>
                        {sold && (
                          <span
                            className={`${badgeBase} border-emerald-200 bg-emerald-50 text-emerald-700`}
                          >
                            Đã bán vé
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-disabled={sold}
                          title={sold ? MSG04 : undefined}
                          onClick={() => {
                            if (!sold) onEdit(showtime);
                          }}
                          className={`${actionBase} border-border-main text-text-main hover:bg-surface-muted`}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          aria-disabled={sold}
                          title={sold ? MSG05 : undefined}
                          onClick={() => {
                            if (!sold) onDelete(showtime);
                          }}
                          className={`${actionBase} border-red-200 text-status-danger hover:bg-primary-50`}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-sub">
          <span>
            Trang {data.page}/{data.totalPages} - Tổng{" "}
            {data.total.toLocaleString("vi-VN")} suất chiếu
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
