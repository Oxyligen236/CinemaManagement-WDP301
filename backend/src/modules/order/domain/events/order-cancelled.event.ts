import { DomainEvent } from '../../../../common/domain/domain-event';

export class OrderCancelledEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly staffId: string | undefined,
    public readonly seatShowtimeIds: string[],
    public readonly reason: string,
    public readonly cancelledAt: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'order.cancelled';
  }
}
