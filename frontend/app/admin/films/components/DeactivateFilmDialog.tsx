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
      <div className="w-full max-w-md border border-[#dad2b4] bg-white font-['Arial',sans-serif] shadow-xl">
        <div className="border-b border-[#dad2b4] bg-[#efebdb] px-5 py-3">
          <h2
            id="deactivate-title"
            className="text-[14px] font-bold uppercase text-[#231f20]"
          >
            Vô hiệu hóa phim
          </h2>
        </div>
        <div className="p-5">
          <p className="text-[13px] text-[#666]">
            Bạn có chắc muốn vô hiệu hóa phim{" "}
            <strong className="text-[#231f20]">{movie.movieName}</strong>?
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 border border-[#da291c] bg-[#fef2f2] px-3 py-2 text-[13px] font-bold text-[#da291c]"
            >
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-[#dad2b4] bg-[#efebdb] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-[38px] cursor-pointer items-center border border-[#dad2b4] bg-white px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex h-[38px] cursor-pointer items-center bg-[#da291c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
