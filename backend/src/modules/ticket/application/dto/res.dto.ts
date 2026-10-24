import { TicketStatus } from '../../domain/enums/ticket-status.enum';

export class TicketDetailRes {
  ticketId!: string;
  ticketCode!: string;
  orderId!: string;
  price!: number;
  ticketStatus!: TicketStatus;
  usedAt?: Date;
  seatShowtimeId!: string;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  startTime!: Date;
  endTime!: Date;

  static of(
    ticketId: string,
    ticketCode: string,
    orderId: string,
    price: number,
    ticketStatus: TicketStatus,
    usedAt: Date | undefined,
    seatShowtimeId: string,
    movieTitle: string,
    roomName: string,
    seatLabel: string,
    startTime: Date,
    endTime: Date,
  ): TicketDetailRes {
    const res = new TicketDetailRes();
    res.ticketId = ticketId;
    res.ticketCode = ticketCode;
    res.orderId = orderId;
    res.price = price;
    res.ticketStatus = ticketStatus;
    res.usedAt = usedAt;
    res.seatShowtimeId = seatShowtimeId;
    res.movieTitle = movieTitle;
    res.roomName = roomName;
    res.seatLabel = seatLabel;
    res.startTime = startTime;
    res.endTime = endTime;
    return res;
  }
}

export class ScanTicketResultRes {
  ticketId!: string;
  ticketCode!: string;
  orderId!: string;
  price!: number;
  ticketStatus!: TicketStatus;
  usedAt?: Date;
  seatShowtimeId!: string;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  startTime!: Date;
  endTime!: Date;
  scannedBy!: string;
  scannedAt!: Date;
  message!: string;

  static of(
    ticketId: string,
    ticketCode: string,
    orderId: string,
    price: number,
    ticketStatus: TicketStatus,
    usedAt: Date | undefined,
    seatShowtimeId: string,
    movieTitle: string,
    roomName: string,
    seatLabel: string,
    startTime: Date,
    endTime: Date,
    scannedBy: string,
    scannedAt: Date,
    message: string,
  ): ScanTicketResultRes {
    const res = new ScanTicketResultRes();
    res.ticketId = ticketId;
    res.ticketCode = ticketCode;
    res.orderId = orderId;
    res.price = price;
    res.ticketStatus = ticketStatus;
    res.usedAt = usedAt;
    res.seatShowtimeId = seatShowtimeId;
    res.movieTitle = movieTitle;
    res.roomName = roomName;
    res.seatLabel = seatLabel;
    res.startTime = startTime;
    res.endTime = endTime;
    res.scannedBy = scannedBy;
    res.scannedAt = scannedAt;
    res.message = message;
    return res;
  }
}
