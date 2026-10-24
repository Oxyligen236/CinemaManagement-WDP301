/** Hình dạng chung của document `seat_price_rules` / `day_price_rules` (mỗi document = 1 giá trị hệ số). */
export interface PriceRuleRecord {
  ruleId: string;
  seatType?: string;
  dayType?: string;
  adjustmentValue: number;
  updatedAt: Date;
}

/** Tên field khóa trường trong document: `seatType` (nhóm ghế) hoặc `dayType` (nhóm ngày). */
export type PriceRuleKeyName = 'seatType' | 'dayType';
