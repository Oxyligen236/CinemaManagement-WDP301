const DECIMAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * Chuẩn hoá giá trị đầu vào của hệ số nhân (dùng với @Transform).
 * - undefined / null / chuỗi rỗng -> undefined (để IsDefined bắt, MSG02)
 * - chuỗi số thập phân hợp lệ ("1.5") -> number
 * - các giá trị khác ("abc", true, [], {}, NaN...) giữ nguyên để IsNumber bắt
 */
export function toNumberOrKeep({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return DECIMAL_PATTERN.test(trimmed) ? Number(trimmed) : value;
  }
  return value;
}
