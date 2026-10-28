import { SeatType } from '../../../pricerule/domain/enums/seat-type.enum';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';

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

export class StaffShowtimeItemResDto {
  showtimeId!: string;
  movieId!: string;
  movieTitle!: string;
  moviePosterUrl!: string | null;
  roomId!: string;
  roomName!: string;
  branchId!: string;
  branchName!: string;
  startTime!: Date;
  endTime!: Date;
  basePrice!: number;
  format!: string;
  availableSeats!: number;
  totalSeats!: number;
}

export class PublicShowtimeItemResDto {
  showtimeId!: string;
  movieId!: string;
  movieName!: string;
  duration!: number;
  posterUrl?: string;
  genreNames?: string[];
  roomId!: string;
  roomName!: string;
  branchId?: string;
  branchName?: string;
  startTime!: Date;
  endTime!: Date;
  basePrice!: number;
  availableSeats?: number;
  totalSeats?: number;
}
