import Dexie from 'dexie';
import { db } from './schema';

/**
 * Reset the Phylax database for test isolation.
 * Deletes the database and re-opens a fresh instance.
 * Only for use in test files.
 */
export async function resetDatabase(): Promise<void> {
  db.close();
  await Dexie.delete('phylax');
  await db.open();
}
