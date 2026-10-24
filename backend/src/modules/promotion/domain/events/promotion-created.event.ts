import { DomainEvent } from '../../../../common/domain/domain-event';
import { DiscountType } from '../enums/discount-type.enum';

export class PromotionCreatedEvent extends DomainEvent {
  constructor(
    public readonly promotionId: string,
    public readonly promotionCode: string,
    public readonly discountType: DiscountType,
    public readonly discountValue: number,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly isActive: boolean,
  ) {
    super();
  }

  getEventName(): string {
    return 'promotion.created';
  }
}
