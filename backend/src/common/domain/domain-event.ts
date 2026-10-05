export abstract class DomainEvent {
  readonly occurredOn: Date;

  constructor() {
    this.occurredOn = new Date();
  }

  abstract getEventName(): string;

  serialize(): string {
    return JSON.stringify(this);
  }
}
