/**
 * Date-range filter utility (O-18). URL-as-state convention extends
 * the O-17 `?q=<term>` pattern with `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
 * Both bounds are independently optional. Empty / missing params
 * mean "no bound on that side", not "epoch zero" or "now".
 *
 * Two value flavors: observations key off `createdAt` (epoch ms),
 * lab reports key off `reportDate` (ISO date string `YYYY-MM-DD`).
 * Predicates are offered for both to keep the call sites local and
 * avoid coercion mistakes.
 *
 * Lexicographic compare on `YYYY-MM-DD` is order-correct for the ISO
 * case so it can run as a plain string compare. Epoch comparisons
 * convert the bound to start-of-day UTC for `from` and end-of-day
 * UTC for `to`, so a single calendar day "captures" any
 * `createdAt` within that day regardless of timezone.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validated ISO date string in `YYYY-MM-DD` form, or undefined. */
export function parseDateBound(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  if (!ISO_DATE_RE.test(trimmed)) return undefined;
  // Round-trip parse to reject e.g. 2024-02-30.
  const ts = Date.parse(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(ts)) return undefined;
  const back = new Date(ts).toISOString().slice(0, 10);
  if (back !== trimmed) return undefined;
  return trimmed;
}

export interface DateRange {
  from?: string;
  to?: string;
}

/** Read `from` and `to` from a URLSearchParams instance, validated. */
export function parseDateRange(params: URLSearchParams): DateRange {
  return {
    from: parseDateBound(params.get('from')),
    to: parseDateBound(params.get('to')),
  };
}

/**
 * `from` empty -> no lower bound. `to` empty -> no upper bound.
 * Both empty -> always true (date filter inactive).
 */
export function isInDateRangeEpoch(epochMs: number, range: DateRange): boolean {
  if (range.from) {
    const fromEpoch = Date.parse(`${range.from}T00:00:00.000Z`);
    if (!Number.isNaN(fromEpoch) && epochMs < fromEpoch) return false;
  }
  if (range.to) {
    const toEpoch = Date.parse(`${range.to}T23:59:59.999Z`);
    if (!Number.isNaN(toEpoch) && epochMs > toEpoch) return false;
  }
  return true;
}

/**
 * Compare ISO `YYYY-MM-DD` strings lexicographically. Caller is
 * responsible for passing a valid ISO date; invalid forms compare
 * unpredictably. `range.from`/`to` are already validated by
 * `parseDateRange`, so combined with parsed dates this is safe.
 */
export function isInDateRangeIso(isoDate: string, range: DateRange): boolean {
  if (range.from && isoDate < range.from) return false;
  if (range.to && isoDate > range.to) return false;
  return true;
}

/** True when at least one bound is set, i.e., the filter narrows results. */
export function isDateRangeActive(range: DateRange): boolean {
  return Boolean(range.from) || Boolean(range.to);
}
