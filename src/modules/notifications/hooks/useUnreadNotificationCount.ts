import {
  NOTIFICATIONS_POLL_INTERVAL_MS,
  NOTIFICATIONS_QUERY_KEYS,
} from '../constants/notification.constants';
import { notificationService } from '../services/notificationService';

import { useQuery } from '@tanstack/react-query';

/**
 * The bell badge count — mirrors `useKdsQueue`'s polling shape exactly.
 * `refetchIntervalInBackground: false` (the default) is intentional: a
 * backgrounded tab shouldn't keep hammering the endpoint every 5s.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount,
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
  });
}
