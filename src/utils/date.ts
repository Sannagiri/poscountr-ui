/**
 * Today's date in IST, `YYYY-MM-DD` — the same day boundary the backend
 * stamps onto every order's `tokenDate` (`OrderService.create`'s
 * `timezone.now().astimezone(IST).date()`), so filtering/comparing against
 * `tokenDate` anywhere in the frontend always agrees with what the backend
 * meant by "today," regardless of the browser's own local timezone.
 *
 * `offsetDays` shifts by whole IST calendar days — e.g. `dateIST(-1)` for
 * "yesterday" — by nudging the underlying instant rather than the
 * already-formatted string, so it stays correct across a DST-less zone
 * like IST without any calendar-math edge cases.
 */
export function dateIST(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Converts an absolute instant (e.g. `Invoice.issuedAt`, any UTC ISO
 * datetime) to its IST calendar-day string — same IST day-boundary
 * convention as `dateIST()` above, but for a timestamp that already exists
 * rather than "now". Used wherever a report/filter needs to bucket a
 * datetime field by the same day the backend would consider it to fall on.
 */
export function toISTDate(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
