/** `"1234.50"` -> `"₹1234.50"` — matches the `₹{x.toFixed(2)}` convention already used throughout billing/reports. */
export function formatMoney(value: string | number): string {
  return `₹${Number(value).toFixed(2)}`;
}

/** `"29.87"` -> `"29.9%"`. */
export function formatPercent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}

/** Compact axis-tick form for a rupee amount — lakhs, not thousands, since that's the unit Indian currency actually steps in. `125000` -> `"₹1.3L"`, `4200` -> `"₹4.2k"`. */
export function formatCompactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${value.toFixed(0)}`;
}

/**
 * `date` is a plain `YYYY-MM-DD` calendar day (e.g. `Order.tokenDate`), not
 * an instant — parsed and re-rendered with `timeZone: 'UTC'` so the day
 * never shifts backward for a viewer whose browser is west of UTC (`new
 * Date('2026-06-01')` parses as UTC midnight; formatting in the browser's
 * own local zone would otherwise roll that back to May 31 in, say, US
 * timezones). This mirrors why `dateIST`/`toISTDate` (`@/utils/date`) pin an
 * explicit zone for the same class of bug — those convert an *instant* to
 * its IST day; this formats a day that's already resolved.
 */
export function formatShortDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...options,
  });
}
