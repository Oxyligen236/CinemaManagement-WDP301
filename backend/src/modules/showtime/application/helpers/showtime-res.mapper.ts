import {
  ShowtimeDayPriceSelectionResDto,
  ShowtimeResDto,
  ShowtimeSeatPriceSelectionResDto,
} from '../dto/res.dto';

export function toShowtimeResDto(doc: any): ShowtimeResDto {
  return ShowtimeResDto.of({
    showtimeId: doc.id,
    movieId: doc.movieId,
    roomId: doc.roomId,
    startTime: doc.startTime,
    endTime: doc.endTime,
    basePrice: doc.basePrice,
    dayPriceRuleId: doc.dayPriceRuleId ?? undefined,
    seatPriceRuleId: doc.seatPriceRuleId ?? undefined,
    seatPriceSelections: (doc.seatPriceSelections ?? []).map((s: any) =>
      ShowtimeSeatPriceSelectionResDto.of(
        s.seatType,
        s.ruleId ?? null,
        s.multiplier,
      ),
    ),
    dayPriceSelections: (doc.dayPriceSelections ?? []).map((s: any) =>
      ShowtimeDayPriceSelectionResDto.of(
        s.dayType,
        s.ruleId ?? null,
        s.multiplier,
      ),
    ),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}
