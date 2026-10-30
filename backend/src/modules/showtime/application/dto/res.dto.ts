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

  static from(params: {
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
    res.showtimeId = params.showtimeId;
    res.movieId = params.movieId;
    res.roomId = params.roomId;
    res.startTime = params.startTime;
    res.endTime = params.endTime;
    res.basePrice = params.basePrice;
    res.dayPriceRuleId = params.dayPriceRuleId;
    res.seatPriceRuleId = params.seatPriceRuleId;
    res.seatPriceSelections = params.seatPriceSelections;
    res.dayPriceSelections = params.dayPriceSelections;
    res.createdAt = params.createdAt;
    res.updatedAt = params.updatedAt;
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

  static from(params: {
    seatShowtimeId: string;
    showtimeId: string;
    seatId: string;
    seatStatus: SeatShowtimeStatus;
    rowPosition: string;
    columnPosition: number;
    seatType: SeatType;
  }): SeatShowtimeResDto {
    const res = new SeatShowtimeResDto();
    res.seatShowtimeId = params.seatShowtimeId;
    res.showtimeId = params.showtimeId;
    res.seatId = params.seatId;
    res.seatStatus = params.seatStatus;
    res.rowPosition = params.rowPosition;
    res.columnPosition = params.columnPosition;
    res.seatType = params.seatType;
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

  static from(params: {
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
    format: string;
    availableSeats: number;
    totalSeats: number;
  }): StaffShowtimeItemResDto {
    const res = new StaffShowtimeItemResDto();
    res.showtimeId = params.showtimeId;
    res.movieId = params.movieId;
    res.movieTitle = params.movieTitle;
    res.moviePosterUrl = params.moviePosterUrl;
    res.roomId = params.roomId;
    res.roomName = params.roomName;
    res.branchId = params.branchId;
    res.branchName = params.branchName;
    res.startTime = params.startTime;
    res.endTime = params.endTime;
    res.basePrice = params.basePrice;
    res.format = params.format;
    res.availableSeats = params.availableSeats;
    res.totalSeats = params.totalSeats;
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

  static from(params: {
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
    res.showtimeId = params.showtimeId;
    res.movieId = params.movieId;
    res.movieName = params.movieName;
    res.duration = params.duration;
    res.posterUrl = params.posterUrl;
    res.genreNames = params.genreNames;
    res.roomId = params.roomId;
    res.roomName = params.roomName;
    res.branchId = params.branchId;
    res.branchName = params.branchName;
    res.startTime = params.startTime;
    res.endTime = params.endTime;
    res.basePrice = params.basePrice;
    res.availableSeats = params.availableSeats;
    res.totalSeats = params.totalSeats;
    return res;
  }
}
