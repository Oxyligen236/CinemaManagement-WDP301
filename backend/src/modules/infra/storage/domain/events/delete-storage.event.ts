import { DomainEvent } from '../../../../../common/domain/domain-event';

export class DeleteStorageEvent extends DomainEvent {
  static readonly EVENT_NAME = 'storage.delete';

  constructor(public readonly storageIds: string[]) {
    super();
  }

  get keys(): string[] {
    return this.storageIds;
  }

  getEventName(): string {
    return DeleteStorageEvent.EVENT_NAME;
  }

  static deserialize(payload: string): DeleteStorageEvent {
    const data = JSON.parse(payload) as {
      storageIds?: string[];
      keys?: string[];
    };
    return new DeleteStorageEvent(data.storageIds || data.keys || []);
  }
}
