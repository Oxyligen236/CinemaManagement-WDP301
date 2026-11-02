"use client";

import { KeyboardEvent, useEffect, useRef } from "react";

interface Props {
  fieldLabel: string;
  multiplierText: string;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeletePriceValueDialog({
  fieldLabel,
  multiplierText,
  submitting,
  error,
  onConfirm,
  onClose,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!submitting) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [cancelRef.current, confirmRef.current].filter(
      (el): el is HTMLButtonElement => el !== null && !el.disabled,
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-price-value-title"
      aria-describedby="delete-price-value-desc"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md border border-[#dad2b4] bg-white font-['Arial',sans-serif] shadow-xl">
        <div className="border-b border-[#dad2b4] bg-[#efebdb] px-5 py-3">
          <h2
            id="delete-price-value-title"
            className="text-[14px] font-bold uppercase text-[#231f20]"
          >
            Xóa giá trị hệ số
          </h2>
        </div>
        <div className="p-5">
          <p id="delete-price-value-desc" className="text-[13px] text-[#666]">
            Xóa hệ số <strong className="text-[#231f20]">{multiplierText}</strong> của{" "}
            <strong className="text-[#231f20]">{fieldLabel}</strong>? Các suất chiếu đã dùng giá trị này vẫn
            giữ nguyên hệ số đã chọn.
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
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-[38px] cursor-pointer items-center border border-[#dad2b4] bg-white px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => {
              if (!submitting) onConfirm();
            }}
            aria-disabled={submitting}
            className="inline-flex h-[38px] cursor-pointer items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] aria-disabled:cursor-not-allowed aria-disabled:opacity-70"
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
