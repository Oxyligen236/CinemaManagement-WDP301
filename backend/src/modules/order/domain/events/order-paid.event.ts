import { DomainEvent } from '../../../../common/domain/domain-event';

export class OrderPaidEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly actorId: string,
    public readonly branchId: string | undefined,
    public readonly totalAmount: number,
    public readonly paymentMethod: string,
    public readonly paidAt: Date,
    public readonly promotionId?: string,
    public readonly userId?: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'order.paid';
  }
}
