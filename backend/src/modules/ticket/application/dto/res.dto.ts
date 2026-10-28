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
  branchId?: string;
  branchName?: string;
  branchAddress?: string;

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
    branchId?: string,
    branchName?: string,
    branchAddress?: string,
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
    res.branchId = branchId;
    res.branchName = branchName;
    res.branchAddress = branchAddress;
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
  branchId!: string;
  branchName!: string;
  branchAddress?: string;
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
    branchId: string,
    branchName: string,
    branchAddress: string | undefined,
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
    res.branchId = branchId;
    res.branchName = branchName;
    res.branchAddress = branchAddress;
    res.scannedBy = scannedBy;
    res.scannedAt = scannedAt;
    res.message = message;
    return res;
  }
}

export class TicketItemSummaryRes {
  ticketId!: string;
  ticketCode!: string;
  price!: number;
  ticketStatus!: string;
  usedAt?: Date;
  seatShowtimeId!: string;
  movieTitle!: string;
  roomName!: string;
  seatLabel!: string;
  startTime!: Date;
  endTime!: Date;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
}

export type TicketItemSummaryDto = TicketItemSummaryRes;
