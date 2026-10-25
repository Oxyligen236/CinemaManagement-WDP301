"use client";

import { formatMultiplier, PriceOptionField } from "../api";

export interface SavedSelection {
  ruleId: string | null;
  multiplier: number;
}

interface Props {
  fields: PriceOptionField[];
  /** Selected `ruleId` per `priceKey`; empty string means "not applied". */
  selections: Record<string, string>;
  /** Snapshot stored on the showtime being edited (absent when creating). */
  saved: Record<string, SavedSelection>;
  disabled: boolean;
  onChange: (key: string, ruleId: string) => void;
}

const FIELD_TITLE: Record<string, string> = {
  VIP: "Ghế VIP",
  COUPLE: "Ghế Couple",
  WEEKEND: "Cuối tuần",
  HOLIDAY: "Ngày lễ",
};

export const priceKey = (group: string, fieldKey: string) =>
  `${group}:${fieldKey}`;

const selectClass =
  "h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-70";

export default function PriceMultiplierSelects({
  fields,
  selections,
  saved,
  disabled,
  onChange,
}: Props) {
  return (
    <fieldset className="rounded-lg border border-border-main p-3 sm:col-span-2 sm:p-4">
      <legend className="px-1 text-sm font-semibold text-text-main">
        Hệ số giá
      </legend>
      <p className="mb-3 text-xs text-text-muted">
        Chọn hệ số áp dụng cho suất chiếu này. Để trống nghĩa là không áp dụng
        (1.0x).
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const key = priceKey(field.group, field.fieldKey);
          const id = `price-${field.group}-${field.fieldKey}`;
          const savedItem = saved[key];
          const orphan =
            savedItem?.ruleId &&
            !field.values.some((value) => value.ruleId === savedItem.ruleId)
              ? savedItem
              : null;
          return (
            <label key={key} htmlFor={id} className="block">
              <span className="mb-1 block text-sm font-medium text-text-sub">
                {FIELD_TITLE[field.fieldKey] ?? field.label}
              </span>
              <select
                id={id}
                value={selections[key] ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(key, e.target.value)}
                className={selectClass}
              >
                <option value="">Không áp dụng (1.0x)</option>
                {orphan && orphan.ruleId && (
                  <option value={orphan.ruleId}>
                    Đã lưu: {formatMultiplier(orphan.multiplier)}x (không còn
                    trong cấu hình)
                  </option>
                )}
                {field.values.map((value) => (
                  <option key={value.ruleId} value={value.ruleId}>
                    {formatMultiplier(value.multiplier)}x
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
