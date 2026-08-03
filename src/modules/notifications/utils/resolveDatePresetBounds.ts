import { dateIST } from '@/utils/date';

import type { NotificationDatePreset } from '../constants/notification.constants';

/**
 * Turns a `NotificationDatePreset` into concrete `dateFrom`/`dateTo` bounds
 * (`YYYY-MM-DD`, IST calendar days, inclusive both ends) for the backend's
 * `?date_from=&date_to=` query params. `'all'` returns `{}` — no bound, the
 * backend's own `limit` cap is the only ceiling.
 *
 * `lastMonth` is the only one that needs real calendar-month arithmetic;
 * done via `Date.UTC` on the plain year/month numbers pulled from `dateIST()`
 * (not `Asia/Kolkata`-aware itself) — safe here because by this point
 * `year`/`month` are already the correct IST calendar values, so what's left
 * is pure calendar-day math with no timezone/DST involved (IST has none).
 */
export function resolveDatePresetBounds(preset: NotificationDatePreset): {
  dateFrom?: string;
  dateTo?: string;
} {
  if (preset === 'today') {
    const today = dateIST();
    return { dateFrom: today, dateTo: today };
  }
  if (preset === 'yesterday') {
    const yesterday = dateIST(-1);
    return { dateFrom: yesterday, dateTo: yesterday };
  }
  if (preset === 'week') {
    return { dateFrom: dateIST(-6), dateTo: dateIST() };
  }
  if (preset === 'month') {
    const today = dateIST();
    return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today };
  }
  if (preset === 'lastMonth') {
    const [year, month] = dateIST().split('-').map(Number);
    const lastDayOfPrevMonth = new Date(Date.UTC(year, month - 1, 1) - 24 * 60 * 60 * 1000);
    const prevYear = lastDayOfPrevMonth.getUTCFullYear();
    const prevMonth = String(lastDayOfPrevMonth.getUTCMonth() + 1).padStart(2, '0');
    return {
      dateFrom: `${prevYear}-${prevMonth}-01`,
      dateTo: lastDayOfPrevMonth.toISOString().slice(0, 10),
    };
  }
  return {};
}
