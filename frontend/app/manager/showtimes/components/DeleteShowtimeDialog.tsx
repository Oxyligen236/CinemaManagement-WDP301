"use client";

import { KeyboardEvent, useEffect, useRef } from "react";
import { formatDate, formatTime, ManagedShowtime } from "../api";
import { trapTab, useRestoreFocus } from "./dialogFocus";

interface Props {
  showtime: ManagedShowtime;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteShowtimeDialog({
  showtime,
  submitting,
  error,
  onConfirm,
  onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useRestoreFocus();

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!submitting) onClose();
      return;
    }
    trapTab(event, rootRef.current);
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-showtime-title"
      aria-describedby="delete-showtime-desc"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-4 shadow-card sm:p-6">
        <h2
          id="delete-showtime-title"
          className="text-lg font-bold text-text-main"
        >
          Xóa suất chiếu
        </h2>
        <p id="delete-showtime-desc" className="mt-2 text-sm text-text-sub">
          Xóa suất chiếu <strong>{showtime.movieName}</strong> tại{" "}
          <strong>{showtime.roomName}</strong>, ngày{" "}
          <strong>{formatDate(showtime.startTime)}</strong> lúc{" "}
          <strong>{formatTime(showtime.startTime)}</strong>? Thao tác này không
          thể hoàn tác.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-danger"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-lg border border-border-main bg-white px-4 text-sm font-medium text-text-main transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              if (!submitting) onConfirm();
            }}
            aria-disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-status-danger px-4 text-sm font-medium text-white transition-colors hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-primary-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-70 motion-reduce:transition-none"
          >
            {submitting && (
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
            )}
            {submitting ? "Đang xóa..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
