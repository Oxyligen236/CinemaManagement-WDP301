import { DeleteStorageHandler } from '../../application/handlers/delete-storage.handler';
import { DeleteStorageEvent } from '../../domain/events/delete-storage.event';
import { StorageListener } from './storage.listener';

describe('StorageListener', () => {
  let listener: StorageListener;
  let deleteStorageHandler: { handle: jest.Mock };

  beforeEach(() => {
    deleteStorageHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };
    listener = new StorageListener(
      deleteStorageHandler as unknown as DeleteStorageHandler,
    );
  });

  it('forwards DeleteStorageEvent instance directly to handler', async () => {
    const event = new DeleteStorageEvent(['movies/1.jpg']);

    await listener.handleDeleteStorage(event);

    expect(deleteStorageHandler.handle).toHaveBeenCalledWith(event);
  });

  it('deserializes string payload before forwarding to handler', async () => {
    const serialized = new DeleteStorageEvent(['movies/2.jpg']).serialize();

    await listener.handleDeleteStorage(serialized);

    expect(deleteStorageHandler.handle).toHaveBeenCalledWith(
      expect.any(DeleteStorageEvent),
    );
    expect(deleteStorageHandler.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        storageIds: ['movies/2.jpg'],
      }),
    );
  });
});
