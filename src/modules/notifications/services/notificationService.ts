import { apiClient, unwrap } from '@/services/apiClient';

import type { AppNotification, NotificationType } from '../types/notification.types';

/**
 * All calls to `/tenant/notifications/` live here — components and hooks
 * never call `apiClient` directly (docs/coding-standards.md §14). The
 * endpoint is `IsTenantUser`-gated server-side (any tenant-bound role has
 * their own inbox); which notifications a caller sees is entirely a
 * function of who they were fanned out to (`apps.notifications.rules`) —
 * there's no client-side filtering to reproduce here.
 */

interface NotificationRaw {
  id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_object_type: string;
  related_object_id: string | null;
  location_id: string | null;
  location_name: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

function mapNotification(raw: NotificationRaw): AppNotification {
  return {
    id: raw.id,
    notificationType: raw.notification_type,
    title: raw.title,
    message: raw.message,
    relatedObjectType: raw.related_object_type,
    relatedObjectId: raw.related_object_id,
    locationId: raw.location_id,
    locationName: raw.location_name,
    actorName: raw.actor_name,
    metadata: raw.metadata,
    isRead: raw.is_read,
    readAt: raw.read_at,
    createdAt: raw.created_at,
  };
}

export interface NotificationListFilters {
  /** Maps to the backend's `?status=unread|read` — omit for "every notification". */
  status?: 'unread' | 'read';
  /** Maps to `?type=` — a single NotificationType to narrow to. */
  type?: NotificationType;
  /** IST calendar day bounds (`YYYY-MM-DD`, inclusive both ends) — bounds an otherwise-unbounded activity log. */
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export const notificationService = {
  async listNotifications(filters: NotificationListFilters = {}): Promise<AppNotification[]> {
    const body = await unwrap<NotificationRaw[]>(
      apiClient.get('/tenant/notifications/', {
        params: {
          status: filters.status,
          type: filters.type,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          limit: filters.limit,
        },
      }),
    );
    return body.map(mapNotification);
  },

  /** The cheap, frequently-polled unread badge count. */
  async getUnreadCount(): Promise<number> {
    const body = await unwrap<{ unread_count: number }>(
      apiClient.get('/tenant/notifications/unread-count/'),
    );
    return body.unread_count;
  },

  async markRead(notificationId: string): Promise<AppNotification> {
    const raw = await unwrap<NotificationRaw>(
      apiClient.post(`/tenant/notifications/${notificationId}/read/`),
    );
    return mapNotification(raw);
  },

  async markAllRead(): Promise<void> {
    await unwrap(apiClient.post('/tenant/notifications/mark-all-read/'));
  },
};
