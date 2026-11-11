"use client";

import { FormEvent, useState } from "react";
import {
  MAX_VALUES_PER_FIELD,
  MSG_MAX_VALUES,
  SubmitResult,
  validateMultiplierInput,
} from "../api";

interface Props {
  inputId: string;
  fieldLabel: string;
  existing: number[];
  /** True while any write operation of the card is running. */
  disabled: boolean;
  /** True while this form's own request is running. */
  submitting: boolean;
  onSubmit: (value: number) => Promise<SubmitResult>;
}

export default function AddPriceValueForm({
  inputId,
  fieldLabel,
  existing,
  disabled,
  submitting,
  onSubmit,
}: Props) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const full = existing.length >= MAX_VALUES_PER_FIELD;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : "", full ? hintId : ""]
    .filter(Boolean)
    .join(" ");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || full) return;
    const result = validateMultiplierInput(raw, existing);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    const outcome = await onSubmit(result.value);
    if (outcome.done) setRaw("");
    else if (outcome.error) setError(outcome.error);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-5 border-t border-[#f0eee4] pt-4">
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]"
      >
        Thêm giá trị
      </label>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ví dụ: 1.5"
            value={raw}
            disabled={full}
            readOnly={disabled}
            onChange={(e) => {
              setRaw(e.target.value);
              setError("");
            }}
            aria-label={`Hệ số mới cho ${fieldLabel}`}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={describedBy || undefined}
            className={`h-[38px] w-full border bg-[#fcfbfa] pl-3 pr-8 text-[13px] text-[#231f20] placeholder:text-[#9d9580] focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-70 read-only:opacity-70 ${
              error
                ? "border-[#da291c] focus:border-[#da291c] focus:ring-[#da291c]"
                : "border-[#dad2b4] focus:border-[#da291c] focus:ring-[#da291c]"
            }`}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-[#9d9580]"
          >
            x
          </span>
        </div>
        <button
          type="submit"
          disabled={full}
          aria-disabled={disabled || full}
          className="inline-flex h-[38px] cursor-pointer items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] disabled:cursor-not-allowed disabled:opacity-70 aria-disabled:cursor-not-allowed aria-disabled:opacity-70 motion-reduce:transition-none"
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
          {submitting ? "Đang thêm..." : "Thêm"}
        </button>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-bold text-[#da291c]">
          {error}
        </p>
      )}
      {full && (
        <p id={hintId} className="mt-1.5 text-xs font-bold text-[#da291c]">
          {MSG_MAX_VALUES}
        </p>
      )}
    </form>
  );
}
