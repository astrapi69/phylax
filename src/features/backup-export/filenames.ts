/**
 * Filename formatter for `.phylax` backup exports.
 *
 * `phylax-backup-YYYYMMDD-HHmmss.phylax` in local time.
 *
 * Rationale:
 *   - ISO-ordered prefix: sortable in file managers
 *   - seconds precision: prevents same-minute collisions on retries
 *   - local time: matches the clock the user sees on the device
 *     (the envelope's `created` field is UTC for absolute reference;
 *     the filename is contextual)
 */

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function pad4(n: number): string {
  return n.toString().padStart(4, '0');
}

export function formatBackupFilename(date: Date = new Date()): string {
  const yyyy = pad4(date.getFullYear());
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `phylax-backup-${yyyy}${mm}${dd}-${hh}${mi}${ss}.phylax`;
}
