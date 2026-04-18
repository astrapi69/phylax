/**
 * Trigger a browser download of the given content. Pure DOM: constructs a
 * Blob, creates an object URL, clicks a synthetic anchor, and revokes the
 * URL. No network involvement. Works for strings (text/markdown/csv) and
 * pre-built Blobs (PDF).
 */
export function triggerDownload(content: string | Blob, filename: string, mimeType: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Must be in the DOM for the synthetic click to take effect in some
  // browsers; remove immediately after.
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
