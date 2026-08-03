import type { AppNotification } from '../types/notification.types';

/** Search matches title, message, actor, and location — shared by the bell's filter row and the full NotificationsPage so the two never drift on what "search" means here. */
export function getNotificationSearchValue(notification: AppNotification): string {
  return [
    notification.title,
    notification.message,
    notification.actorName ?? '',
    notification.locationName ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}
