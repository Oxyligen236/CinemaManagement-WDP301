export class ManagerContextResDto {
  branchId!: string;
  branchName!: string;

  static of(branchId: string, branchName: string): ManagerContextResDto {
    const res = new ManagerContextResDto();
    Object.assign(res, { branchId, branchName });
    return res;
  }
}

export class ManagedSeatPriceSelectionResDto {
  seatType!: string;
  ruleId!: string | null;
  multiplier!: number;

  static of(
    seatType: string,
    ruleId: string | null,
    multiplier: number,
  ): ManagedSeatPriceSelectionResDto {
    const res = new ManagedSeatPriceSelectionResDto();
    Object.assign(res, { seatType, ruleId, multiplier });
    return res;
  }
}

export class ManagedDayPriceSelectionResDto {
  dayType!: string;
  ruleId!: string | null;
  multiplier!: number;

  static of(
    dayType: string,
    ruleId: string | null,
    multiplier: number,
  ): ManagedDayPriceSelectionResDto {
    const res = new ManagedDayPriceSelectionResDto();
    Object.assign(res, { dayType, ruleId, multiplier });
    return res;
  }
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

  static of(params: {
    showtimeId: string;
    movieId: string;
    movieName: string;
    movieDuration: number;
    posterUrl?: string;
    roomId: string;
    roomName: string;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    seatPriceSelections: ManagedSeatPriceSelectionResDto[];
    dayPriceSelections: ManagedDayPriceSelectionResDto[];
    hasSoldTickets: boolean;
  }): ManagedShowtimeResDto {
    const res = new ManagedShowtimeResDto();
    Object.assign(res, params);
    return res;
  }
}

// DELETE: bản ghi vừa xóa
export class ShowtimeMutationResDto {
  message!: string;
  showtime!: ManagedShowtimeResDto;

  static of(
    message: string,
    showtime: ManagedShowtimeResDto,
  ): ShowtimeMutationResDto {
    const res = new ShowtimeMutationResDto();
    Object.assign(res, { message, showtime });
    return res;
  }
}
