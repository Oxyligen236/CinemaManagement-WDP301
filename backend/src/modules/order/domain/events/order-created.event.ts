import { DomainEvent } from '../../../../common/domain/domain-event';
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly expiresAt: Date,
    public readonly seatShowtimeIds: string[],
  ) {
    super();
  }
  getEventName(): string {
    return 'order.created';
  }
}
