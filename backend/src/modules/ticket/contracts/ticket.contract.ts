export interface TicketItemSummaryDto {
  ticketId: string;
  ticketCode: string;
  price: number;
  ticketStatus: string;
  usedAt?: Date;
  seatShowtimeId: string;
  movieTitle: string;
  roomName: string;
  seatLabel: string;
  startTime: Date;
  endTime: Date;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
}

export const TICKET_CONTRACT = Symbol('TICKET_CONTRACT');

export interface TicketContract {
  getTicketsByOrderId(orderId: string): Promise<TicketItemSummaryDto[]>;
  createTicketsForOrder(
    params: {
      orderId: string;
      seatShowtimeIds: string[];
    },
    session?: ClientSession,
  ): Promise<TicketItemSummaryDto[]>;
}
import { ClientSession } from 'mongoose';
