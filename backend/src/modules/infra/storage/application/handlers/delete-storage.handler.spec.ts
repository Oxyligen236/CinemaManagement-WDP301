import { Logger } from '@nestjs/common';
import { DeleteStorageEvent } from '../../domain/events/delete-storage.event';
import { StorageService } from '../interface/storage.interface';
import { DeleteStorageHandler } from './delete-storage.handler';

describe('DeleteStorageHandler', () => {
  let handler: DeleteStorageHandler;
  let storageService: { delete: jest.Mock };
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    storageService = { delete: jest.fn() };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    handler = new DeleteStorageHandler(
      storageService as unknown as StorageService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes all storageIds in the event', async () => {
    storageService.delete.mockResolvedValue(undefined);
    const event = new DeleteStorageEvent(['a.jpg', 'b.jpg']);

    await handler.handle(event);

    expect(logSpy).toHaveBeenCalledWith(
      'Handling storage delete for IDs: a.jpg, b.jpg',
    );
    expect(storageService.delete).toHaveBeenCalledTimes(2);
    expect(storageService.delete).toHaveBeenNthCalledWith(1, 'a.jpg');
    expect(storageService.delete).toHaveBeenNthCalledWith(2, 'b.jpg');
  });

  it('falls back to event.keys when storageIds is undefined', async () => {
    storageService.delete.mockResolvedValue(undefined);
    const event = { keys: ['fallback.jpg'] } as unknown as DeleteStorageEvent;

    await handler.handle(event);

    expect(storageService.delete).toHaveBeenCalledTimes(1);
    expect(storageService.delete).toHaveBeenCalledWith('fallback.jpg');
  });

  it('returns early when storageIds is empty or event is nullish', async () => {
    await handler.handle(new DeleteStorageEvent([]));
    await handler.handle(undefined as unknown as DeleteStorageEvent);

    expect(storageService.delete).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('catches deletion errors per key and continues processing remaining IDs', async () => {
    const err = new Error('S3 delete error');
    storageService.delete
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce('raw-delete-error')
      .mockResolvedValueOnce(undefined);

    await expect(
      handler.handle(
        new DeleteStorageEvent(['bad1.jpg', 'bad2.jpg', 'ok.jpg']),
      ),
    ).resolves.toBeUndefined();

    expect(storageService.delete).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to delete storage with ID: bad1.jpg',
      err.stack,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to delete storage with ID: bad2.jpg',
      'raw-delete-error',
    );
  });
});
