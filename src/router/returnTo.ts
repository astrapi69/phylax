/**
 * Extract a safe returnTo path from URL search params.
 *
 * Validates the path is relative (starts with /) and not protocol-relative (//).
 * Returns /profile as fallback for missing, empty, or unsafe values.
 * Prevents open-redirect attacks via crafted unlock URLs.
 */
export function getSafeReturnTo(params: URLSearchParams): string {
  const returnTo = params.get('returnTo');
  if (!returnTo) return '/profile';
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/profile';
  return returnTo;
}
