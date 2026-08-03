import { BILLING_ROUTES } from '@/modules/billing';
import { BUSINESSES_ROUTES } from '@/modules/businesses';
import { INVENTORY_ROUTES } from '@/modules/inventory';
import { PURCHASING_ROUTES } from '@/modules/purchasing';
import { QUOTATIONS_ROUTES } from '@/modules/quotations';
import { TEAM_ROUTES } from '@/modules/team';

import type { AppNotification } from '../types/notification.types';

/**
 * Maps a notification's `relatedObjectType` — the backend's own
 * `type(related_object).__name__.lower()` (e.g. "purchaseorder", no
 * underscore) — to where clicking it should navigate. Quotations/purchase
 * orders/orders have a real per-id detail page; location/product/staff
 * notifications land on their module's list page since those don't have
 * one yet. Shared by `NotificationBell` and `NotificationsPage` so the two
 * surfaces never drift on where a given event type deep-links to.
 */
export function resolveNotificationRoute(notification: AppNotification): string | null {
  switch (notification.relatedObjectType) {
    case 'quotation':
      return notification.relatedObjectId
        ? QUOTATIONS_ROUTES.quotationDetail(notification.relatedObjectId)
        : null;
    case 'purchaseorder':
      return notification.relatedObjectId
        ? PURCHASING_ROUTES.purchaseOrderDetail(notification.relatedObjectId)
        : null;
    case 'order':
      return notification.relatedObjectId
        ? BILLING_ROUTES.orderDetail(notification.relatedObjectId)
        : null;
    case 'location':
      return BUSINESSES_ROUTES.locations;
    case 'product':
      return INVENTORY_ROUTES.products;
    case 'user':
      return TEAM_ROUTES.staff;
    default:
      return null;
  }
}
