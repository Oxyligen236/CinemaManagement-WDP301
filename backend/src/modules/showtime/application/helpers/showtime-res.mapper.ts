import { Showtime } from '../../domain/schemas/showtime.schema';
import { ShowtimeResDto } from '../dto/res.dto';

type ShowtimeSource = Pick<
  Showtime,
  '_id' | 'movieId' | 'roomId' | 'startTime' | 'endTime' | 'basePrice'
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
  return ShowtimeResDto.from({
    showtimeId: doc._id.toString(),
    movieId: doc.movieId.toString(),
    roomId: doc.roomId.toString(),
    startTime: doc.startTime,
    endTime: doc.endTime,
    basePrice: doc.basePrice,
    dayPriceRuleId: doc.dayPriceRuleId
      ? doc.dayPriceRuleId.toString()
      : undefined,
    seatPriceRuleId: doc.seatPriceRuleId
      ? doc.seatPriceRuleId.toString()
      : undefined,
    seatPriceSelections: (doc.seatPriceSelections ?? []).map((s) => ({
      seatType: s.seatType,
      ruleId: s.ruleId ? s.ruleId.toString() : null,
      multiplier: s.multiplier,
    })),
    dayPriceSelections: (doc.dayPriceSelections ?? []).map((s) => ({
      dayType: s.dayType,
      ruleId: s.ruleId ? s.ruleId.toString() : null,
      multiplier: s.multiplier,
    })),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  });
}
