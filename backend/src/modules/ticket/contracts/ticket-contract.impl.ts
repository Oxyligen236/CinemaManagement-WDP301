import { Injectable } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { TicketService } from '../application/services/ticket.service';
import { TicketContract, TicketItemSummaryDto } from './ticket.contract';

@Injectable()
export class TicketContractImpl implements TicketContract {
  constructor(private readonly ticketService: TicketService) {}

  async getTicketsByOrderId(orderId: string): Promise<TicketItemSummaryDto[]> {
    return this.ticketService.getTicketsByOrderId(orderId);
  }

  async createTicketsForOrder(
    params: {
      orderId: string;
      seatShowtimeIds: string[];
    },
    session?: ClientSession,
  ): Promise<TicketItemSummaryDto[]> {
    return session
      ? this.ticketService.createTicketsForOrder(params, session)
      : this.ticketService.createTicketsForOrder(params);
  }
}
