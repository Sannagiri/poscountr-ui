/** Mirrors the backend's `NotificationType.choices` (apps/notifications/constants.py). */
export type NotificationType =
  | 'quotation_created'
  | 'quotation_accepted'
  | 'quotation_declined'
  | 'purchase_order_created'
  | 'purchase_order_completed'
  | 'purchase_order_cancelled'
  | 'purchase_order_payment_recorded'
  | 'low_stock_alert'
  | 'location_created'
  | 'staff_added'
  | 'staff_deactivated'
  | 'order_created'
  | 'order_kot_fired'
  | 'order_preparing'
  | 'order_ready'
  | 'order_delivered'
  | 'order_completed'
  | 'order_cancelled';

export interface AppNotification {
  id: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  /**
   * The backend's `type(related_object).__name__.lower()` — e.g.
   * "quotation", "purchaseorder" (no underscore), "order", "location",
   * "product", "user". Empty string when the event has no deep-link target.
   */
  relatedObjectType: string;
  relatedObjectId: string | null;
  locationId: string | null;
  /** Null for a tenant-wide event (e.g. a new location being created). */
  locationName: string | null;
  /** Who did it — "You" when the viewer is the actor, null for a system-triggered event (e.g. low stock). */
  actorName: string | null;
  metadata: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
