import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from '../../ticket/domain/schemas/ticket.schema';
import { TicketContract, TicketItemSummaryDto } from './ticket.contract';
import { SHOWTIME_CONTRACT, ShowtimeContract } from '../../ticket/contracts/showtime.contract';
import { Inject } from '@nestjs/common';

@Injectable()
export class TicketContractImpl implements TicketContract {
  constructor(
    @InjectModel(Ticket.name) private readonly ticketModel: Model<TicketDocument>,
    @Inject(SHOWTIME_CONTRACT) private readonly showtimeContract: ShowtimeContract,
  ) {}

  async getTicketsByOrderId(orderId: string): Promise<TicketItemSummaryDto[]> {
    const tickets = await this.ticketModel.find({ orderId }).exec();
    return Promise.all(tickets.map(async (ticket) => {
      const detail = await this.showtimeContract.getSeatShowtimeDetail(ticket.seatShowtimeId);
      return {
        ticketId: ticket.ticketId,
        ticketCode: ticket.ticketCode,
        price: ticket.price,
        ticketStatus: ticket.ticketStatus,
        usedAt: ticket.usedAt,
        seatShowtimeId: ticket.seatShowtimeId,
        movieTitle: detail?.movieTitle ?? '',
        roomName: detail?.roomName ?? '',
        seatLabel: detail ? `${detail.rowPosition || ''}${detail.columnPosition || ''}` : '',
        startTime: detail?.startTime ?? new Date(),
        endTime: detail?.endTime ?? new Date(),
      };
    }));
  }
}
