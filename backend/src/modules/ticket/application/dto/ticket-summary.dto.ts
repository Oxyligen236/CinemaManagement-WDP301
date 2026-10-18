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
}
