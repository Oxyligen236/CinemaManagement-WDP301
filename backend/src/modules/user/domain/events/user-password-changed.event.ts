export class UserPasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly changedAt: Date,
  ) {}
}
