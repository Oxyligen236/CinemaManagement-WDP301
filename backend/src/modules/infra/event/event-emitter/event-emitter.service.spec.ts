import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '../../../../common/domain/domain-event';
import { EventEmitterService } from './event-emitter.service';

class TestDomainEvent extends DomainEvent {
  constructor(public readonly id: string) {
    super();
  }

  getEventName(): string {
    return 'test.event';
  }
}

describe('EventEmitterService', () => {
  it('publishes serialized domain event via emitAsync', async () => {
    const emitAsync = jest.fn().mockResolvedValue([]);
    const service = new EventEmitterService({
      emitAsync,
    } as unknown as EventEmitter2);
    const event = new TestDomainEvent('evt-1');

    await service.publish(event);

    expect(emitAsync).toHaveBeenCalledWith('test.event', event.serialize());
  });
});
