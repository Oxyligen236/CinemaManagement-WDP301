import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { Ticket, TicketDocument } from '../../domain/schemas/ticket.schema';

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

  static of(source: Ticket | TicketDocument | Record<string, any>): TicketDetailRes {
    const doc = (source as any)?._doc ?? source ?? {};
    const res = new TicketDetailRes();
    Object.assign(res, doc);
    return res;
  }

  static ofArray(sources: (Ticket | TicketDocument | Record<string, any>)[] | null | undefined): TicketDetailRes[] {
    return (sources ?? []).map((s) => TicketDetailRes.of(s));
  }
}

export class ScanTicketResultRes extends TicketDetailRes {
  scannedBy!: string;
  scannedAt!: Date;
  message!: string;

  static of(source: Record<string, any>): ScanTicketResultRes {
    const doc = (source as any)?._doc ?? source ?? {};
    const res = new ScanTicketResultRes();
    Object.assign(res, doc);
    return res;
  }
}
