import { DomainEvent } from '../../../../common/domain/domain-event';

export class UserCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'user.created';

  constructor(
    public readonly email: string,
    public readonly displayName?: string,
  ) {
    super();
  }

  getEventName(): string {
    return UserCreatedEvent.EVENT_NAME;
  }

  static deserialize(payload: string): UserCreatedEvent {
    const data = JSON.parse(payload) as {
      email: string;
      displayName?: string;
    };
    return new UserCreatedEvent(data.email, data.displayName);
  }
}
