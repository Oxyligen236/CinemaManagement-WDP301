import { DomainEvent } from '../../../../common/domain/domain-event';

export class TicketScannedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'ticket.scanned';

  constructor(
    public readonly ticketId: string,
    public readonly ticketCode: string,
    public readonly orderId: string,
    public readonly showtimeId: string,
    public readonly branchId: string,
    public readonly scannedBy: string,
    public readonly scannedAt: Date,
  ) {
    super();
  }

  getEventName(): string {
    return TicketScannedEvent.EVENT_NAME;
  }
}
