import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { generateSalt, unlock, lock } from '../../crypto';
import type { EncryptedRow } from '../types';
import { EncryptedRepository } from './encryptedRepository';
import type { DomainEntity } from './encryptedRepository';

/**
 * Test-only domain entity and repository for verifying base class behavior.
 */
interface TestEntity extends DomainEntity {
  name: string;
  value: number;
  tags: string[];
  nested: { key: string; count: number } | null;
}

class TestDb extends Dexie {
  testItems!: Dexie.Table<EncryptedRow, string>;

  constructor() {
    super('test-encrypted-repo');
    this.version(1).stores({
      testItems: '&id, profileId, [profileId+createdAt]',
    });
  }
}

class TestRepository extends EncryptedRepository<TestEntity> {}

let testDb: TestDb;
let repo: TestRepository;
const salt = generateSalt();
const password = 'test-password';

beforeEach(async () => {
  await Dexie.delete('test-encrypted-repo');
  testDb = new TestDb();
  repo = new TestRepository(testDb.testItems);
  await unlock(password, salt);
});

afterEach(async () => {
  lock();
  testDb.close();
});

function makeTestData(
  overrides: Partial<Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? 'profile-1',
    name: overrides.name ?? 'plaintext-leak-sentinel-xyz789',
    value: overrides.value ?? 42,
    tags: overrides.tags ?? ['alpha', 'beta'],
    nested: overrides.nested === undefined ? { key: 'k', count: 1 } : overrides.nested,
  };
}

describe('EncryptedRepository', () => {
  describe('CRUD', () => {
    it('create and getById round-trip', async () => {
      const data = makeTestData();
      const created = await repo.create(data);
      const fetched = await repo.getById(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched?.name).toBe(data.name);
      expect(fetched?.value).toBe(data.value);
      expect(fetched?.tags).toEqual(data.tags);
      expect(fetched?.nested).toEqual(data.nested);
      expect(fetched?.profileId).toBe(data.profileId);
    });

    it('create auto-generates a UUID-shaped id', async () => {
      const created = await repo.create(makeTestData());
      expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('create auto-sets createdAt and updatedAt close to now', async () => {
      const before = Date.now();
      const created = await repo.create(makeTestData());
      const after = Date.now();

      expect(created.createdAt).toBeGreaterThanOrEqual(before);
      expect(created.createdAt).toBeLessThanOrEqual(after);
      expect(created.updatedAt).toBe(created.createdAt);
    });

    it('update changes updatedAt but not createdAt', async () => {
      const created = await repo.create(makeTestData());
      // Small delay to ensure timestamp difference
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });

      const updated = await repo.update(created.id, { value: 99 });

      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt).toBeGreaterThan(created.createdAt);
      expect(updated.value).toBe(99);
    });

    it('update throws when patch contains immutable fields', async () => {
      const created = await repo.create(makeTestData());

      await expect(
        repo.update(created.id, { id: 'new-id' } as Partial<TestEntity>),
      ).rejects.toThrow('Cannot modify immutable fields');

      await expect(
        repo.update(created.id, { profileId: 'new-profile' } as Partial<TestEntity>),
      ).rejects.toThrow('Cannot modify immutable fields');

      await expect(
        repo.update(created.id, { createdAt: 0 } as Partial<TestEntity>),
      ).rejects.toThrow('Cannot modify immutable fields');
    });

    it('update throws for unknown id', async () => {
      await expect(repo.update('nonexistent', { value: 1 })).rejects.toThrow(
        'Entity with id "nonexistent" not found',
      );
    });

    it('delete removes the row', async () => {
      const created = await repo.create(makeTestData());
      await repo.delete(created.id);
      const fetched = await repo.getById(created.id);
      expect(fetched).toBeNull();
    });

    it('getById returns null for unknown id', async () => {
      const result = await repo.getById('does-not-exist');
      expect(result).toBeNull();
    });
  });

  describe('listing', () => {
    it('listByProfile returns only matching profileId', async () => {
      await repo.create(makeTestData({ profileId: 'A', name: 'a1' }));
      await repo.create(makeTestData({ profileId: 'A', name: 'a2' }));
      await repo.create(makeTestData({ profileId: 'A', name: 'a3' }));
      await repo.create(makeTestData({ profileId: 'B', name: 'b1' }));
      await repo.create(makeTestData({ profileId: 'B', name: 'b2' }));

      const results = await repo.listByProfile('A');
      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.profileId).toBe('A');
      }
    });

    it('listAll returns every row regardless of profileId', async () => {
      await repo.create(makeTestData({ profileId: 'A', name: 'a1' }));
      await repo.create(makeTestData({ profileId: 'A', name: 'a2' }));
      await repo.create(makeTestData({ profileId: 'B', name: 'b1' }));

      const results = await repo.listAll();
      expect(results).toHaveLength(3);
      const profileIds = results.map((r) => r.profileId).sort();
      expect(profileIds).toEqual(['A', 'A', 'B']);
    });

    it('listAll throws when the key store is locked', async () => {
      await repo.create(makeTestData());
      lock();
      await expect(repo.listAll()).rejects.toThrow('Key store is locked');
    });

    it('listByProfileChronological sorts by createdAt ascending', async () => {
      // Create with explicit small delays to ensure different timestamps
      const first = await repo.create(makeTestData({ name: 'first' }));
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      const second = await repo.create(makeTestData({ name: 'second' }));
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      const third = await repo.create(makeTestData({ name: 'third' }));

      const results = await repo.listByProfileChronological('profile-1');
      expect(results).toHaveLength(3);
      expect(results[0]?.id).toBe(first.id);
      expect(results[1]?.id).toBe(second.id);
      expect(results[2]?.id).toBe(third.id);
    });
  });

  describe('encryption invariant', () => {
    it('plaintext domain content never appears in raw DB row', async () => {
      const sentinel = 'plaintext-leak-sentinel-xyz789';
      const created = await repo.create(makeTestData({ name: sentinel }));

      // Read the raw row directly from Dexie (bypassing the repository)
      const rawRow = await testDb.testItems.get(created.id);
      expect(rawRow).toBeDefined();

      // The payload is an ArrayBuffer containing encrypted bytes.
      // Decode it as UTF-8 and assert the sentinel does NOT appear.
      const payloadBytes = new Uint8Array(rawRow?.payload ?? new ArrayBuffer(0));
      const payloadText = new TextDecoder().decode(payloadBytes);
      expect(payloadText).not.toContain(sentinel);

      // Verify structural metadata IS present as plaintext
      expect(rawRow?.id).toBe(created.id);
      expect(rawRow?.profileId).toBe('profile-1');
      expect(rawRow?.createdAt).toBe(created.createdAt);
      expect(rawRow?.updatedAt).toBe(created.updatedAt);
    });
  });

  describe('locked key store', () => {
    it('throws on all operations when locked', async () => {
      const created = await repo.create(makeTestData());
      lock();

      await expect(repo.create(makeTestData())).rejects.toThrow('Key store is locked');
      await expect(repo.getById(created.id)).rejects.toThrow('Key store is locked');
      await expect(repo.update(created.id, { value: 1 })).rejects.toThrow('Key store is locked');
      // delete does not decrypt, so it does not throw on locked store
      await expect(repo.listByProfile('profile-1')).rejects.toThrow('Key store is locked');
    });
  });

  describe('complex domain fields', () => {
    it('round-trip preserves strings, numbers, arrays, nested objects, and null', async () => {
      const data = makeTestData({
        name: 'complex test with special chars: "quotes" and \\backslash',
        value: -3.14159,
        tags: ['one', 'two', 'three', ''],
        nested: { key: 'deep-value', count: 999 },
      });

      const created = await repo.create(data);
      const fetched = await repo.getById(created.id);

      expect(fetched?.name).toBe(data.name);
      expect(fetched?.value).toBe(data.value);
      expect(fetched?.tags).toEqual(data.tags);
      expect(fetched?.nested).toEqual(data.nested);
    });

    it('round-trip preserves null nested field', async () => {
      const data = makeTestData({ nested: null });
      const created = await repo.create(data);
      const fetched = await repo.getById(created.id);

      expect(fetched?.nested).toBeNull();
    });
  });

  describe('subclass extensibility', () => {
    it('subclass can override create using protected serialize', async () => {
      // Verifies the private->protected visibility change works for subclass overrides
      const { generateId } = await import('../../crypto');

      class CustomRepository extends EncryptedRepository<TestEntity> {
        async create(
          data: Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>,
        ): Promise<TestEntity> {
          const id = generateId();
          const now = Date.now();
          const entity: TestEntity = { ...data, id, createdAt: now, updatedAt: now };
          const row = await this.serialize(entity);
          await this.table.put(row);
          return entity;
        }
      }

      const customRepo = new CustomRepository(testDb.testItems);
      const created = await customRepo.create(makeTestData());

      expect(created.id).toMatch(/^[0-9a-f]{8}-/);

      const fetched = await customRepo.getById(created.id);
      expect(fetched?.name).toBe(created.name);
    });
  });
});
