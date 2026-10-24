import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';
import { SeatType } from '../../../room/domain/enums/seat-type.enum';

export class ShowtimeSeatPriceSelectionResDto {
  seatType!: string;
  ruleId!: string | null;
  multiplier!: number;
}

export class ShowtimeDayPriceSelectionResDto {
  dayType!: string;
  ruleId!: string | null;
  multiplier!: number;
}

export class ShowtimeResDto {
  showtimeId!: string;
  movieId!: string;
  roomId!: string;
  startTime!: Date;
  endTime!: Date;
  basePrice!: number;
  dayPriceRuleId?: string;
  seatPriceRuleId?: string;
  seatPriceSelections?: ShowtimeSeatPriceSelectionResDto[];
  dayPriceSelections?: ShowtimeDayPriceSelectionResDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class SeatShowtimeResDto {
  seatShowtimeId!: string;
  showtimeId!: string;
  seatId!: string;
  seatStatus!: SeatShowtimeStatus;
  rowPosition!: string;
  columnPosition!: number;
  seatType!: SeatType;
}
