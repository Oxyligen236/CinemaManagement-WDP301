import { DeleteStorageEvent } from './delete-storage.event';

describe('DeleteStorageEvent', () => {
  it('stores storageIds, exposes keys getter, and returns EVENT_NAME', () => {
    const event = new DeleteStorageEvent(['movies/1.jpg', 'movies/2.jpg']);

    expect(event.storageIds).toEqual(['movies/1.jpg', 'movies/2.jpg']);
    expect(event.keys).toEqual(['movies/1.jpg', 'movies/2.jpg']);
    expect(event.getEventName()).toBe('storage.delete');
    expect(DeleteStorageEvent.EVENT_NAME).toBe('storage.delete');
  });

  it('deserializes payload containing storageIds', () => {
    const payload = JSON.stringify({ storageIds: ['a.png', 'b.png'] });

    const event = DeleteStorageEvent.deserialize(payload);

    expect(event).toBeInstanceOf(DeleteStorageEvent);
    expect(event.storageIds).toEqual(['a.png', 'b.png']);
  });

  it('deserializes payload containing keys fallback', () => {
    const payload = JSON.stringify({ keys: ['legacy/k1.png'] });

    const event = DeleteStorageEvent.deserialize(payload);

    expect(event.storageIds).toEqual(['legacy/k1.png']);
  });

  it('defaults to empty array when payload has neither storageIds nor keys', () => {
    const event = DeleteStorageEvent.deserialize('{}');

    expect(event.storageIds).toEqual([]);
  });
});
