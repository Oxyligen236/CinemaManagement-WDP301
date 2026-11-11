"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { PriceValue, SubmitResult, validateMultiplierInput } from "../api";

interface Props {
  value: PriceValue;
  fieldLabel: string;
  /** Multipliers currently in the field (including this row's own value). */
  existing: number[];
  /** True while any write operation of the card is running. */
  disabled: boolean;
  /** True while this row's own PATCH is running. */
  saving: boolean;
  onSave: (value: number) => Promise<SubmitResult>;
  onDelete: () => void;
}

const numberFormat = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
});

const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatMultiplier(multiplier: number): string {
  return `${numberFormat.format(multiplier)}x`;
}

const iconButtonClass =
  "inline-flex h-[34px] cursor-pointer items-center justify-center border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20] focus-visible:ring-1 focus-visible:ring-[#da291c] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

export default function PriceValueRow({
  value,
  fieldLabel,
  existing,
  disabled,
  saving,
  onSave,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  const text = formatMultiplier(value.multiplier);
  const inputId = `edit-${value.ruleId}`;
  const errorId = `${inputId}-error`;

  useEffect(() => {
    if (!editing && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  function startEdit() {
    setDraft(String(value.multiplier));
    setError("");
    setEditing(true);
  }

  function cancel() {
    if (saving) return;
    restoreFocusRef.current = true;
    setEditing(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const result = validateMultiplierInput(draft, existing, value.multiplier);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (result.value === value.multiplier) {
      cancel();
      return;
    }
    setError("");
    const outcome = await onSave(result.value);
    if (outcome.done) {
      restoreFocusRef.current = true;
      setEditing(false);
    } else if (outcome.error) {
      setError(outcome.error);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  return (
    <li className="border border-[#dad2b4] bg-[#fcfbfa] px-3 py-2.5">
      {editing ? (
        <form onSubmit={submit} noValidate>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[8rem] flex-1">
              <input
                id={inputId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={draft}
                readOnly={disabled}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                aria-label={`Hệ số mới thay cho ${text} của ${fieldLabel}`}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? errorId : undefined}
                className={`h-[38px] w-full border bg-white pl-3 pr-8 text-[13px] text-[#231f20] focus:outline-none focus:ring-1 read-only:cursor-not-allowed read-only:opacity-70 ${
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
            <div className="flex gap-2">
              <button
                type="submit"
                aria-disabled={disabled}
                className="inline-flex h-[34px] cursor-pointer items-center gap-2 bg-[#da291c] px-4 text-[12px] font-bold text-white transition-colors hover:bg-[#b82116] aria-disabled:cursor-not-allowed aria-disabled:opacity-70 motion-reduce:transition-none"
              >
                {saving && (
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
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className={iconButtonClass}
              >
                Hủy
              </button>
            </div>
          </div>
          {error && (
            <p id={errorId} className="mt-1 text-xs font-bold text-[#da291c]">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-['Georgia',serif] text-[20px] font-bold text-[#231f20]">{text}</p>
            <p className="text-[12px] text-[#666]">
              Cập nhật lần cuối:{" "}
              {value.updatedAt
                ? dateTimeFormat.format(new Date(value.updatedAt))
                : "-"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              ref={editButtonRef}
              type="button"
              onClick={startEdit}
              disabled={disabled}
              aria-label={`Sửa hệ số ${text} của ${fieldLabel}`}
              className={iconButtonClass}
            >
              Sửa
            </button>
            <button
              type="button"
              data-delete-rule={value.ruleId}
              onClick={onDelete}
              disabled={disabled}
              aria-label={`Xóa hệ số ${text} của ${fieldLabel}`}
              className="inline-flex h-[34px] cursor-pointer items-center justify-center border border-[#fecaca] bg-white px-3 text-[12px] font-bold text-[#da291c] transition-colors hover:bg-[#fef2f2] focus-visible:ring-1 focus-visible:ring-[#da291c] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
