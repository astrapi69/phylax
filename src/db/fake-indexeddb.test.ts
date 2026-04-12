import { describe, it, expect, beforeEach } from 'vitest';

describe('fake-indexeddb round-trip', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    const request = indexedDB.open('test-db', 1);

    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = () => {
        request.result.createObjectStore('items', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });

  it('stores and retrieves a record', async () => {
    const record = { id: 'entry-1', name: 'Test Entry', value: 42 };

    // Put
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('items', 'readwrite');
      tx.objectStore('items').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Get
    const result = await new Promise<typeof record>((resolve, reject) => {
      const tx = db.transaction('items', 'readonly');
      const getRequest = tx.objectStore('items').get('entry-1');
      getRequest.onsuccess = () => resolve(getRequest.result as typeof record);
      getRequest.onerror = () => reject(getRequest.error);
    });

    expect(result).toEqual(record);
    expect(result.id).toBe('entry-1');
    expect(result.name).toBe('Test Entry');
    expect(result.value).toBe(42);
  });
});
