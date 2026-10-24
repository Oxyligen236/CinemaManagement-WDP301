import { DomainEvent } from '../../../../common/domain/domain-event';

export class PromotionStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly promotionId: string,
    public readonly promotionCode: string,
    public readonly isActive: boolean,
  ) {
    super();
  }

  getEventName(): string {
    return 'promotion.status_changed';
  }
}
