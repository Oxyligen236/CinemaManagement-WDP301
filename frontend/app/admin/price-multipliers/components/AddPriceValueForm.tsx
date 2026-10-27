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
    <form onSubmit={submit} noValidate className="mt-4">
      <label
        htmlFor={inputId}
        className="mb-1 block text-sm font-medium text-text-main"
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
            className={`h-10 w-full rounded-lg border bg-white pl-3 pr-8 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-70 read-only:opacity-70 ${
              error
                ? "border-status-danger focus:border-status-danger focus:ring-status-danger"
                : "border-border-main focus:border-primary-600 focus:ring-primary-600"
            }`}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-muted"
          >
            x
          </span>
        </div>
        <button
          type="submit"
          disabled={full}
          aria-disabled={disabled || full}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-70 aria-disabled:cursor-not-allowed aria-disabled:opacity-70 motion-reduce:transition-none"
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
        <p id={errorId} className="mt-1 text-xs text-status-danger">
          {error}
        </p>
      )}
      {full && (
        <p id={hintId} className="mt-1 text-xs text-status-danger">
          {MSG_MAX_VALUES}
        </p>
      )}
    </form>
  );
}
