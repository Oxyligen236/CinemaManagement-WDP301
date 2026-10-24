import { DomainEvent } from '../../../../common/domain/domain-event';
export class OrderExpiredEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly seatShowtimeIds: string[],
    public readonly expiredAt: Date,
  ) {
    super();
  }
  getEventName(): string {
    return 'order.expired';
  }
}
