import { ShowtimeResDto } from '../dto/res.dto';

export function toShowtimeResDto(doc: any): ShowtimeResDto {
  const dto = new ShowtimeResDto();
  dto.showtimeId = doc.id;
  dto.movieId = doc.movieId;
  dto.roomId = doc.roomId;
  dto.startTime = doc.startTime;
  dto.endTime = doc.endTime;
  dto.basePrice = doc.basePrice;
  dto.dayPriceRuleId = doc.dayPriceRuleId ?? undefined;
  dto.seatPriceRuleId = doc.seatPriceRuleId ?? undefined;
  dto.seatPriceSelections = (doc.seatPriceSelections ?? []).map((s: any) => ({
    seatType: s.seatType,
    ruleId: s.ruleId ?? null,
    multiplier: s.multiplier,
  }));
  dto.dayPriceSelections = (doc.dayPriceSelections ?? []).map((s: any) => ({
    dayType: s.dayType,
    ruleId: s.ruleId ?? null,
    multiplier: s.multiplier,
  }));
  dto.createdAt = doc.createdAt;
  dto.updatedAt = doc.updatedAt;
  return dto;
}
