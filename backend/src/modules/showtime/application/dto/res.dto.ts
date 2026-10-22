import { BranchStatus } from '../../../branch/domain/enums/branch-status.enum';
import { MovieStatus } from '../../../movie/domain/enums/movie-status.enum';
import { RoomStatus } from '../../../room/domain/enums/room-status.enum';
import { SeatStatus } from '../../../room/domain/enums/seat-status.enum';
import { SeatType } from '../../../room/domain/enums/seat-type.enum';
import { SeatShowtimeStatus } from '../../domain/enums/seat-showtime-status.enum';

export class ManagerBranchDto {
  branchId!: string;
  branchName!: string;
  address!: string;
  branchStatus!: BranchStatus;
}

export class ShowtimeMovieOptionDto {
  movieId!: string;
  movieName!: string;
  duration!: number;
  status!: MovieStatus;
  posterKey?: string;
  isActive!: boolean;
}

export class ShowtimeRoomOptionDto {
  roomId!: string;
  roomName!: string;
  roomStatus!: RoomStatus;
  branchId!: string;
  totalSeats!: number;
  availableSeats!: number;
}

export class ShowtimeOptionsResponseDto {
  branch!: ManagerBranchDto;
  movies!: ShowtimeMovieOptionDto[];
  rooms!: ShowtimeRoomOptionDto[];
}

export class BranchShowtimeItemDto {
  showtimeId!: string;
  movieId!: string;
  movieName!: string;
  duration!: number;
  movieStatus!: MovieStatus;
  posterKey!: string | null;
  roomId!: string;
  roomName!: string;
  roomStatus!: RoomStatus;
  startTime!: Date;
  endTime!: Date;
  basePrice!: number;
  totalSeats!: number;
  bookedSeats!: number;
  reservedSeats!: number;
  availableSeats!: number;
  hasSoldTickets!: boolean;
  isPast!: boolean;
  isOngoing!: boolean;
}

export class BranchShowtimeListResponseDto {
  branch!: ManagerBranchDto;
  showtimes!: BranchShowtimeItemDto[];
  total!: number;
}

export class BranchShowtimeDetailResponseDto {
  branch!: ManagerBranchDto;
  showtime!: BranchShowtimeItemDto;
}

export class BranchShowtimeMutationResponseDto {
  message!: string;
  showtime!: BranchShowtimeItemDto;
}

export class BranchShowtimeDeleteResponseDto {
  message!: string;
  showtimeId!: string;
}

export class PublicShowtimeItemDto {
  showtimeId!: string;
  movieId!: string;
  movieName!: string;
  duration!: number;
  movieStatus!: MovieStatus;
  posterKey!: string | null;
  branchId!: string;
  branchName!: string;
  branchAddress!: string;
  roomId!: string;
  roomName!: string;
  startTime!: Date;
  endTime!: Date;
  basePrice!: number;
  totalSeats!: number;
  availableSeats!: number;
}

export class PublicShowtimeListResponseDto {
  branches!: ManagerBranchDto[];
  movies!: ShowtimeMovieOptionDto[];
  showtimes!: PublicShowtimeItemDto[];
  total!: number;
}

export class PublicShowtimeSeatDto {
  seatShowtimeId!: string;
  seatId!: string;
  seatCode!: string;
  rowPosition!: string;
  columnPosition!: number;
  seatType!: SeatType;
  roomSeatStatus!: SeatStatus;
  bookingStatus!: SeatShowtimeStatus;
  isSelectable!: boolean;
  price!: number;
}

export class PublicShowtimeSeatsResponseDto {
  showtime!: PublicShowtimeItemDto;
  seats!: PublicShowtimeSeatDto[];
  pricing!: {
    basePrice: number;
    dayAdjustment: number;
    seatAdjustments: Record<SeatType, number>;
  };
}
