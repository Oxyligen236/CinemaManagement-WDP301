'use client';

import { formatMultiplier, PriceOptionField } from '../api';

export interface SavedSelection {
  ruleId: string | null;
  multiplier: number;
}

interface Props {
  fields: PriceOptionField[];
  /** Selected `ruleId` per `priceKey`; empty string means "not applied" (1.0x). */
  selections: Record<string, string>;
  /** Snapshot stored on the showtime being edited (empty when creating). */
  saved: Record<string, SavedSelection>;
  /** Creating: show which value is the Admin default for each field. */
  creating: boolean;
  disabled: boolean;
  onChange: (key: string, ruleId: string) => void;
}

export const PRICE_FIELD_TITLE: Record<string, string> = {
  VIP: 'Ghế VIP',
  COUPLE: 'Ghế Couple',
  WEEKEND: 'Cuối tuần',
  HOLIDAY: 'Ngày lễ',
};

export const priceKey = (group: string, fieldKey: string) =>
  `${group}:${fieldKey}`;

/** First configured value of each field (the list is sorted ascending by the backend). */
export function defaultSelections(
  fields: PriceOptionField[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const first = field.values[0];
    if (first) result[priceKey(field.group, field.fieldKey)] = first.ruleId;
  }
  return result;
}

export default function PriceMultiplierFields({
  fields,
  selections,
  saved,
  creating,
  disabled,
  onChange,
}: Props) {
  return (
    <fieldset className="border border-[#dad2b4] bg-[#fcfbfa] p-4">
      <legend className="px-2 text-[12px] font-bold uppercase text-[#231f20]">
        Hệ số giá
      </legend>
      <p className="mb-3 text-[12px] text-[#6f6247]">
        Chọn hệ số áp dụng cho suất chiếu này theo cấu hình của Admin. Chọn
        &quot;Không áp dụng&quot; nghĩa là không tăng giá (1.0x).
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
          const first = field.values[0];
          return (
            <div key={key}>
              <label
                htmlFor={id}
                className="mb-1 block text-[12px] font-bold uppercase text-[#231f20]"
              >
                {PRICE_FIELD_TITLE[field.fieldKey] ?? field.label}
              </label>
              <select
                id={id}
                value={selections[key] ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(key, e.target.value)}
                className="h-[42px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
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
              {creating && (
                <p className="mt-1 text-[11px] text-[#6f6247]">
                  {first
                    ? `Mặc định theo cấu hình Admin: ${formatMultiplier(first.multiplier)}x`
                    : 'Admin chưa cấu hình giá trị cho trường này.'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
