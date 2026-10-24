export const SHOWTIME_BOOKING = Symbol('SHOWTIME_BOOKING');
export interface SeatBookingDetail {
  seatShowtimeId: string;
  showtimeId: string;
  seatId: string;
  rowPosition: string;
  columnPosition: number;
  seatType: string;
  seatStatus: string;
  basePrice: number;
  startTime: Date;
  endTime: Date;
  roomId: string;
  roomName: string;
  movieId: string;
  movieName: string;
}
export interface ShowtimeBookingContract {
  reserveSeats(ids: string[]): Promise<SeatBookingDetail[]>;
  releaseSeats(ids: string[]): Promise<number>;
  getSeatBookingDetails(ids: string[]): Promise<SeatBookingDetail[]>;
}
