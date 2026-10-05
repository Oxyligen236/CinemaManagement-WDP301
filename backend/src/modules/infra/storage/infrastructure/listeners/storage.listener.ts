import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeleteStorageEvent } from '../../domain/events/delete-storage.event';
import { DeleteStorageHandler } from '../../application/handlers/delete-storage.handler';

@Injectable()
export class StorageListener {
  private readonly logger = new Logger(StorageListener.name);

  constructor(private readonly deleteStorageHandler: DeleteStorageHandler) {}

  @OnEvent(DeleteStorageEvent.EVENT_NAME, { async: true })
  async handleDeleteStorage(event: DeleteStorageEvent | string): Promise<void> {
    const payload =
      typeof event === 'string' ? DeleteStorageEvent.deserialize(event) : event;
    return this.deleteStorageHandler.handle(payload);
  }
}
