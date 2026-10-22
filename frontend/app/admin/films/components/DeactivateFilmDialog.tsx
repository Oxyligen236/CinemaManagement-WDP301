"use client";

import { useState } from "react";
import { ApiError, deactivateMovie, Movie } from "../api";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

interface Props {
  movie: Movie;
  onClose: () => void;
  onDeactivated: () => void;
}

export default function DeactivateFilmDialog({
  movie,
  onClose,
  onDeactivated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await deactivateMovie(movie.movieId);
      onDeactivated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Không thể vô hiệu hóa phim đang có suất chiếu đã lên lịch hoặc đang diễn ra.");
      } else {
        setError(getFriendlyErrorMessage(err, "Không thể vô hiệu hóa phim. Vui lòng thử lại sau."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="deactivate-title"
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-4 shadow-card sm:p-6">
        <h2 id="deactivate-title" className="text-lg font-bold text-text-main">
          Vô hiệu hóa phim
        </h2>
        <p className="mt-2 text-sm text-text-sub">
          Bạn có chắc muốn vô hiệu hóa phim <strong>{movie.movieName}</strong>?
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
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-lg border border-border-main bg-white px-4 text-sm font-medium text-text-main hover:bg-surface-muted"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="h-10 rounded-lg bg-status-danger px-4 text-sm font-medium text-white transition-colors hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
          >
            {submitting ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
