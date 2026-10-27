import { SeatShowtimeStatus } from '../domain/enums/seat-showtime-status.enum';
import { SeatType } from '../../room/domain/enums/seat-type.enum';

export interface SeatBookingDetail {
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
}
