import { DomainEvent } from '../../../../common/domain/domain-event';

export class UserRegisteredEvent extends DomainEvent {
  static readonly EVENT_NAME = 'user.registered';

  constructor(
    public readonly email: string,
    public readonly code: string,
    public readonly expiresInSeconds: number,
    public readonly displayName?: string,
  ) {
    super();
  }

  getEventName(): string {
    return UserRegisteredEvent.EVENT_NAME;
  }

  static deserialize(payload: string): UserRegisteredEvent {
    const data = JSON.parse(payload) as {
      email: string;
      code: string;
      expiresInSeconds: number;
      displayName?: string;
    };
    return new UserRegisteredEvent(
      data.email,
      data.code,
      data.expiresInSeconds,
      data.displayName,
    );
  }
}
