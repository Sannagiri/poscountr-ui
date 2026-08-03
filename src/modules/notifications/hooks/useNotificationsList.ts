import { NOTIFICATIONS_QUERY_KEYS } from '../constants/notification.constants';
import { notificationService } from '../services/notificationService';

import { useQuery } from '@tanstack/react-query';

const PAGE_FETCH_LIMIT = 500;

/**
 * The full Notifications page's data source — server-filtered by date range
 * (the one thing that actually bounds an otherwise-unbounded activity log);
 * type/read-status filtering happens client-side over this fetch via
 * `DataTable`'s own `filters`, same convention as `PurchaseOrdersPage`/
 * `QuotationsPage`. Not polled — the page has its own "Refresh" affordance
 * via TanStack Query's `refetch` instead of a background interval.
 *
 * `enabled` defaults to `true` (the page always wants this fetch); the bell
 * drawer passes `enabled: open` so it shares this same date-filtered source
 * without querying while closed.
 */
export function useNotificationsList(
  dateBounds: { dateFrom?: string; dateTo?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEYS.list(dateBounds),
    queryFn: () =>
      notificationService.listNotifications({ ...dateBounds, limit: PAGE_FETCH_LIMIT }),
    enabled,
  });
}
