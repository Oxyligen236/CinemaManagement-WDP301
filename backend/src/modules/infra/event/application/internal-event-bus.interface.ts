import { DomainEvent } from '../../../../common/domain/domain-event';

export const INTERNAL_EVENT_BUS = Symbol('INTERNAL_EVENT_BUS');

export interface InternalEventBus {
  publish(event: DomainEvent): Promise<void>;
}
