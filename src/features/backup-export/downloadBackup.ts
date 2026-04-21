/**
 * Trigger a browser download for the serialized backup envelope.
 *
 * Thin wrapper around `features/export/download.ts`. The `.phylax`
 * MIME type is `application/json` since the outer envelope IS JSON
 * (the encrypted payload is base64-embedded inside it).
 */

import { triggerDownload } from '../export/download';

export const BACKUP_MIME_TYPE = 'application/json';

export function downloadBackup(json: string, filename: string): void {
  triggerDownload(json, filename, BACKUP_MIME_TYPE);
}
