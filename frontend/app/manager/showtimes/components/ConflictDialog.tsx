"use client";

import { KeyboardEvent, useEffect, useRef } from "react";
import { trapTab, useRestoreFocus } from "./dialogFocus";

interface Props {
  message: string;
  onClose: () => void;
}

export default function ConflictDialog({ message, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useRestoreFocus();

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    trapTab(event, rootRef.current);
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="showtime-conflict-title"
      aria-describedby="showtime-conflict-desc"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-4 shadow-card sm:p-6">
        <h2
          id="showtime-conflict-title"
          className="text-lg font-bold text-status-danger"
        >
          Phòng chiếu bị trùng lịch
        </h2>
        <p id="showtime-conflict-desc" className="mt-2 text-sm text-text-sub">
          {message}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 motion-reduce:transition-none"
          >
            Chọn phòng/khung giờ khác
          </button>
        </div>
      </div>
    </div>
  );
}
