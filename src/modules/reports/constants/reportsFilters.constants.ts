/**
 * When it's on, a day is compared as a plain ISO string against the two
 * bounds (inclusive both ends) — safe since every date here is always a
 * `YYYY-MM-DD` day, which sorts identically as a string or a real date.
 * `null` means "every record," not "none" — that's the `all` preset.
 */
export type DatePreset = 'today' | 'week' | 'month' | 'range' | 'all';

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'range', label: 'Date range' },
  { value: 'all', label: 'All time' },
];

// The reports summary endpoints require concrete `from`/`to` bounds — the
// `all` preset (which a client-side-filtered page like GST summary treats as
// "no filter") substitutes this wide fixed start instead, since there's no
// tenant-creation date available client-side to derive a real one from.
export const ALL_TIME_FROM = '2000-01-01';
