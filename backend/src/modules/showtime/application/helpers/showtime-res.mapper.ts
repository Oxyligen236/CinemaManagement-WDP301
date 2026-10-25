import { Showtime } from '../../domain/schemas/showtime.schema';
import { ShowtimeResDto } from '../dto/res.dto';

type ShowtimeSource = Pick<
  Showtime,
  'showtimeId' | 'movieId' | 'roomId' | 'startTime' | 'endTime' | 'basePrice'
> &
  Partial<
    Pick<
      Showtime,
      | 'dayPriceRuleId'
      | 'seatPriceRuleId'
      | 'seatPriceSelections'
      | 'dayPriceSelections'
    >
  >;

export function toShowtimeResDto(doc: ShowtimeSource): ShowtimeResDto {
  const timestamps = doc as unknown as { createdAt: Date; updatedAt: Date };
  const dto = new ShowtimeResDto();
  dto.showtimeId = doc.showtimeId;
  dto.movieId = doc.movieId;
  dto.roomId = doc.roomId;
  dto.startTime = doc.startTime;
  dto.endTime = doc.endTime;
  dto.basePrice = doc.basePrice;
  dto.dayPriceRuleId = doc.dayPriceRuleId;
  dto.seatPriceRuleId = doc.seatPriceRuleId;
  dto.seatPriceSelections = (doc.seatPriceSelections ?? []).map((s) => ({
    seatType: s.seatType,
    ruleId: s.ruleId ?? null,
    multiplier: s.multiplier,
  }));
  dto.dayPriceSelections = (doc.dayPriceSelections ?? []).map((s) => ({
    dayType: s.dayType,
    ruleId: s.ruleId ?? null,
    multiplier: s.multiplier,
  }));
  dto.createdAt = timestamps.createdAt;
  dto.updatedAt = timestamps.updatedAt;
  return dto;
}
