import { DomainEvent } from '../../../../common/domain/domain-event';

export class TicketScannedEvent extends DomainEvent {
  constructor(
    public readonly ticketId: string,
    public readonly ticketCode: string,
    public readonly scannedBy: string,
    public readonly scannedAt: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ticket.scanned';
  }
}
