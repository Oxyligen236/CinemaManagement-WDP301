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
}

export class ScanTicketResultRes extends TicketDetailRes {
  scannedBy!: string;
  scannedAt!: Date;
  message!: string;
}
