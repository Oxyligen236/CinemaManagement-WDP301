export class ManagerContextResDto {
  branchId!: string;
  branchName!: string;
}

export class ManagedSeatPriceSelectionResDto {
  seatType!: string;
  ruleId!: string | null;
  multiplier!: number;
}

export class ManagedDayPriceSelectionResDto {
  dayType!: string;
  ruleId!: string | null;
  multiplier!: number;
}

export class ManagedShowtimeResDto {
  showtimeId!: string;
  movieId!: string;
  movieName!: string;
  movieDuration!: number;
  posterUrl?: string;
  roomId!: string;
  roomName!: string;
  startTime!: Date;
  endTime!: Date;
  basePrice!: number;
  seatPriceSelections!: ManagedSeatPriceSelectionResDto[];
  dayPriceSelections!: ManagedDayPriceSelectionResDto[];
  // true -> FE vô hiệu hóa Sửa/Xóa (server vẫn chặn)
  hasSoldTickets!: boolean;
}

// DELETE: bản ghi vừa xóa
export class ShowtimeMutationResDto {
  message!: string;
  showtime!: ManagedShowtimeResDto;
}
