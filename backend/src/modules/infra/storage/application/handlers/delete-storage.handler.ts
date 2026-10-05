import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeleteStorageEvent } from '../../domain/events/delete-storage.event';
import { Handler } from '../../../../../common/application/handler';
import { STORAGE_SERVICE } from '../interface/storage.interface';
import type { StorageService } from '../interface/storage.interface';

@Injectable()
export class DeleteStorageHandler implements Handler<DeleteStorageEvent> {
  private readonly logger = new Logger(DeleteStorageHandler.name);

  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  async handle(event: DeleteStorageEvent): Promise<void> {
    const storageIds = event?.storageIds ?? event?.keys ?? [];
    if (!storageIds.length) {
      return;
    }

    this.logger.log(
      `Handling storage delete for IDs: ${storageIds.join(', ')}`,
    );

    await Promise.all(
      storageIds.map(async (storageId) => {
        try {
          await this.storageService.delete(storageId);
        } catch (error) {
          this.logger.error(
            `Failed to delete storage with ID: ${storageId}`,
            error instanceof Error ? error.stack : error,
          );
        }
      }),
    );
  }
}
