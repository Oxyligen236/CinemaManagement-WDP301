import { DomainEvent } from '../../../../common/domain/domain-event';

export class PromotionUpdatedEvent extends DomainEvent {
  constructor(
    public readonly promotionId: string,
    public readonly promotionCode: string,
    public readonly updatedFields: Record<string, any>,
  ) {
    super();
  }

  getEventName(): string {
    return 'promotion.updated';
  }
}
