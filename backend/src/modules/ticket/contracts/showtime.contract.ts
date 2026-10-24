export interface SeatShowtimeDetailDto {
  seatShowtimeId: string;
  showtimeId: string;
  movieId: string;
  movieTitle: string;
  roomId: string;
  roomName: string;
  seatId: string;
  rowPosition: string;
  columnPosition: number;
  startTime: Date;
  endTime: Date;
}

export const SHOWTIME_CONTRACT = Symbol('SHOWTIME_CONTRACT');

export interface ShowtimeContract {
  getSeatShowtimeDetail(
    seatShowtimeId: string,
  ): Promise<SeatShowtimeDetailDto | null>;
}
