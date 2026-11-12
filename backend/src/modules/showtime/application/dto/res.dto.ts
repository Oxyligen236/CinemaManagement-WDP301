import { SeatType } from '../../../pricerule/domain/enums/seat-type.enum';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';

export class ShowtimeSeatPriceSelectionResDto {
  seatType!: string;
  ruleId!: string | null;
  multiplier!: number;

  static of(
    seatType: string,
    ruleId: string | null,
    multiplier: number,
  ): ShowtimeSeatPriceSelectionResDto {
    const res = new ShowtimeSeatPriceSelectionResDto();
    Object.assign(res, { seatType, ruleId, multiplier });
    return res;
  }
}

export class ShowtimeDayPriceSelectionResDto {
  dayType!: string;
  ruleId!: string | null;
  multiplier!: number;

  static of(
    dayType: string,
    ruleId: string | null,
    multiplier: number,
  ): ShowtimeDayPriceSelectionResDto {
    const res = new ShowtimeDayPriceSelectionResDto();
    Object.assign(res, { dayType, ruleId, multiplier });
    return res;
  }
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

  static of(params: {
    showtimeId: string;
    movieId: string;
    roomId: string;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    dayPriceRuleId?: string;
    seatPriceRuleId?: string;
    seatPriceSelections?: ShowtimeSeatPriceSelectionResDto[];
    dayPriceSelections?: ShowtimeDayPriceSelectionResDto[];
    createdAt: Date;
    updatedAt: Date;
  }): ShowtimeResDto {
    const res = new ShowtimeResDto();
    Object.assign(res, params);
    return res;
  }
}

export class SeatShowtimeResDto {
  seatShowtimeId!: string;
  showtimeId!: string;
  seatId!: string;
  seatStatus!: SeatShowtimeStatus;
  rowPosition!: string;
  columnPosition!: number;
  seatType!: SeatType;

  static of(
    seatShowtimeId: string,
    showtimeId: string,
    seatId: string,
    seatStatus: SeatShowtimeStatus,
    rowPosition: string,
    columnPosition: number,
    seatType: SeatType,
  ): SeatShowtimeResDto {
    const res = new SeatShowtimeResDto();
    Object.assign(res, {
      seatShowtimeId,
      showtimeId,
      seatId,
      seatStatus,
      rowPosition,
      columnPosition,
      seatType,
    });
    return res;
  }
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

  static of(params: {
    showtimeId: string;
    movieId: string;
    movieTitle: string;
    moviePosterUrl: string | null;
    roomId: string;
    roomName: string;
    branchId: string;
    branchName: string;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    format?: string;
    availableSeats: number;
    totalSeats: number;
  }): StaffShowtimeItemResDto {
    const res = new StaffShowtimeItemResDto();
    Object.assign(res, {
      format: '2D',
      ...params,
    });
    return res;
  }
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

  static of(params: {
    showtimeId: string;
    movieId: string;
    movieName: string;
    duration: number;
    posterUrl?: string;
    genreNames?: string[];
    roomId: string;
    roomName: string;
    branchId?: string;
    branchName?: string;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    availableSeats?: number;
    totalSeats?: number;
  }): PublicShowtimeItemResDto {
    const res = new PublicShowtimeItemResDto();
    Object.assign(res, params);
    return res;
  }
}

export class SeatBookingDetailDto {
  seatShowtimeId!: string;
  showtimeId!: string;
  seatId!: string;
  rowPosition!: string;
  columnPosition!: number;
  seatType!: SeatType | string;
  seatStatus!: SeatShowtimeStatus | string;
  basePrice!: number;
  startTime!: Date;
  endTime!: Date;
  roomId!: string;
  roomName!: string;
  branchId?: string;
  movieId!: string;
  movieName!: string;
  movieTitle?: string;

  static of(params: {
    seatShowtimeId: string;
    showtimeId: string;
    seatId: string;
    rowPosition: string;
    columnPosition: number;
    seatType: SeatType | string;
    seatStatus: SeatShowtimeStatus | string;
    basePrice: number;
    startTime: Date;
    endTime: Date;
    roomId: string;
    roomName: string;
    branchId?: string;
    movieId: string;
    movieName: string;
    movieTitle?: string;
  }): SeatBookingDetailDto {
    const res = new SeatBookingDetailDto();
    Object.assign(res, params);
    return res;
  }
}

export type SeatBookingDetail = SeatBookingDetailDto;
export const SeatBookingDetail = SeatBookingDetailDto;

export class SeatShowtimeDetailDto {
  seatShowtimeId!: string;
  showtimeId!: string;
  movieId!: string;
  movieTitle!: string;
  roomId!: string;
  roomName!: string;
  seatId!: string;
  rowPosition!: string;
  columnPosition!: number;
  price?: number;
  startTime!: Date;
  endTime!: Date;
  branchId!: string;
  branchName!: string;
  branchAddress?: string;

  static of(params: {
    seatShowtimeId: string;
    showtimeId: string;
    movieId: string;
    movieTitle: string;
    roomId: string;
    roomName: string;
    seatId: string;
    rowPosition: string;
    columnPosition: number;
    price?: number;
    startTime: Date;
    endTime: Date;
    branchId: string;
    branchName: string;
    branchAddress?: string;
  }): SeatShowtimeDetailDto {
    const res = new SeatShowtimeDetailDto();
    Object.assign(res, params);
    return res;
  }
}

export type SeatShowtimeDetail = SeatShowtimeDetailDto;
export const SeatShowtimeDetail = SeatShowtimeDetailDto;
