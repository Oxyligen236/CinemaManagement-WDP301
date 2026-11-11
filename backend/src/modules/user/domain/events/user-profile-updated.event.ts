export class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly updatedFields: { firstName?: string; lastName?: string },
    public readonly updatedAt: Date,
  ) {}
}
