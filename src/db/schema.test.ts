import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { PhylaxDb } from './schema';
import type { ObservationRow, MetaRow } from './types';

const EXPECTED_TABLES = [
  'profiles',
  'observations',
  'lab_values',
  'supplements',
  'open_points',
  'profile_versions',
  'documents',
  'meta',
];

let db: PhylaxDb;

beforeEach(async () => {
  // Delete any existing database to ensure a clean state
  await Dexie.delete('phylax');
  db = new PhylaxDb();
});

function makeRow(overrides: Partial<ObservationRow> = {}): ObservationRow {
  const now = Date.now();
  return {
    id: overrides.id ?? 'test-id',
    profileId: overrides.profileId ?? 'profile-1',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    payload: overrides.payload ?? new ArrayBuffer(0),
  };
}

describe('PhylaxDb schema', () => {
  it('opens cleanly on first access', async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);
    db.close();
  });

  it('declares all expected tables', async () => {
    await db.open();
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([...EXPECTED_TABLES].sort());
    db.close();
  });

  it('primary key put and get works', async () => {
    const row = makeRow({ id: 'obs-1' });
    await db.observations.put(row);
    const result = await db.observations.get('obs-1');
    expect(result).toBeDefined();
    expect(result?.id).toBe('obs-1');
    expect(result?.profileId).toBe('profile-1');
    db.close();
  });

  it('compound index [profileId+createdAt] filters by profileId', async () => {
    const now = Date.now();
    await db.observations.bulkPut([
      makeRow({ id: 'a', profileId: 'p1', createdAt: now }),
      makeRow({ id: 'b', profileId: 'p2', createdAt: now + 1 }),
      makeRow({ id: 'c', profileId: 'p1', createdAt: now + 2 }),
    ]);

    const results = await db.observations
      .where('[profileId+createdAt]')
      .between(['p1', Dexie.minKey], ['p1', Dexie.maxKey])
      .toArray();

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id).sort()).toEqual(['a', 'c']);
    db.close();
  });

  it('meta table uses single-row pattern (overwrite, not append)', async () => {
    const meta1: MetaRow = {
      id: 'singleton',
      salt: new ArrayBuffer(32),
      schemaVersion: 1,
      payload: new ArrayBuffer(0),
    };
    const meta2: MetaRow = {
      id: 'singleton',
      salt: new ArrayBuffer(32),
      schemaVersion: 2,
      payload: new ArrayBuffer(0),
    };

    await db.meta.put(meta1);
    await db.meta.put(meta2);

    const count = await db.meta.count();
    expect(count).toBe(1);

    const result = await db.meta.get('singleton');
    expect(result?.schemaVersion).toBe(2);
    db.close();
  });

  it('profileId is present on every non-meta table', async () => {
    const now = Date.now();
    const profileId = 'profile-xyz';
    const baseRow = { profileId, createdAt: now, updatedAt: now, payload: new ArrayBuffer(0) };

    await db.profiles.put({ id: 'p1', ...baseRow });
    await db.observations.put({ id: 'o1', ...baseRow });
    await db.labValues.put({ id: 'l1', ...baseRow });
    await db.supplements.put({ id: 's1', ...baseRow });
    await db.openPoints.put({ id: 'op1', ...baseRow });
    await db.profileVersions.put({ id: 'v1', ...baseRow });
    await db.documents.put({ id: 'd1', ...baseRow });

    const tables = [
      { table: db.profiles, id: 'p1' },
      { table: db.observations, id: 'o1' },
      { table: db.labValues, id: 'l1' },
      { table: db.supplements, id: 's1' },
      { table: db.openPoints, id: 'op1' },
      { table: db.profileVersions, id: 'v1' },
      { table: db.documents, id: 'd1' },
    ];

    for (const { table, id } of tables) {
      const row = await table.get(id);
      expect(row?.profileId).toBe(profileId);
    }

    db.close();
  });

  it('schema version is 1', () => {
    expect(db.verno).toBe(1);
  });

  it('data persists across close and re-open', async () => {
    const row = makeRow({ id: 'persist-test' });
    await db.observations.put(row);
    db.close();

    const db2 = new PhylaxDb();
    const result = await db2.observations.get('persist-test');
    expect(result).toBeDefined();
    expect(result?.id).toBe('persist-test');
    db2.close();
  });
});
