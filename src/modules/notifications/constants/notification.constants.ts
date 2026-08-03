import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  FilePlus2,
  Flame,
  Landmark,
  MapPin,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Truck,
  UserMinus,
  UserPlus,
  XCircle,
} from 'lucide-react';

import { statusLabel } from '@/utils/status';

import type { NotificationType } from '../types/notification.types';

/** One small icon per event type — shared by the bell dropdown and the full timeline so both read as the same system. */
export const NOTIFICATION_TYPE_ICON: Record<NotificationType, LucideIcon> = {
  quotation_created: FilePlus2,
  quotation_accepted: CheckCircle2,
  quotation_declined: XCircle,
  purchase_order_created: ShoppingCart,
  purchase_order_completed: PackageCheck,
  purchase_order_cancelled: XCircle,
  purchase_order_payment_recorded: Landmark,
  low_stock_alert: AlertTriangle,
  location_created: MapPin,
  staff_added: UserPlus,
  staff_deactivated: UserMinus,
  order_created: Receipt,
  order_kot_fired: ChefHat,
  order_preparing: Flame,
  order_ready: CheckCircle2,
  order_delivered: Truck,
  order_completed: CheckCircle2,
  order_cancelled: XCircle,
};

/** Muted icon tint per event category — a soft tint plus a colored icon, not a solid fill, so the list stays quiet to scan. */
export const NOTIFICATION_TYPE_TONE: Record<NotificationType, string> = {
  quotation_created: 'bg-accent/10 text-accent',
  quotation_accepted: 'bg-success/10 text-success',
  quotation_declined: 'bg-danger/10 text-danger',
  purchase_order_created: 'bg-accent/10 text-accent',
  purchase_order_completed: 'bg-success/10 text-success',
  purchase_order_cancelled: 'bg-danger/10 text-danger',
  purchase_order_payment_recorded: 'bg-success/10 text-success',
  low_stock_alert: 'bg-warning/10 text-warning',
  location_created: 'bg-accent/10 text-accent',
  staff_added: 'bg-success/10 text-success',
  staff_deactivated: 'bg-danger/10 text-danger',
  order_created: 'bg-accent/10 text-accent',
  order_kot_fired: 'bg-accent/10 text-accent',
  order_preparing: 'bg-accent/10 text-accent',
  order_ready: 'bg-success/10 text-success',
  order_delivered: 'bg-success/10 text-success',
  order_completed: 'bg-success/10 text-success',
  order_cancelled: 'bg-danger/10 text-danger',
};

/** Route paths owned by the notifications module — imported by the router, never hardcoded at call sites. */
export const NOTIFICATIONS_ROUTES = {
  notifications: '/notifications',
} as const;

/**
 * TanStack Query cache keys for this module. `list` is a function since the
 * Notifications page's fetch is server-filtered by date range — two
 * different ranges are genuinely two different responses worth caching
 * separately (mirrors `BILLING_QUERY_KEYS.orders`'s own reasoning).
 */
export const NOTIFICATIONS_QUERY_KEYS = {
  unreadCount: ['notifications', 'unread-count'] as const,
  list: (filters: { dateFrom?: string; dateTo?: string } = {}) =>
    ['notifications', 'list', filters] as const,
};

/**
 * There's no push/websocket channel yet (same "realtime story" as
 * `KDS_POLL_INTERVAL_MS` in `apps/billing/constants.ts`'s doc comment) —
 * `refetchInterval` on the unread-count query is the whole mechanism for
 * now. 5s per the product decision to keep this cheap and simple without
 * adding paid infrastructure.
 */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 5000;

/** Every NotificationType the backend can raise (apps/notifications/constants.py) — the full-page filter dropdown's option list. */
const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'quotation_created',
  'quotation_accepted',
  'quotation_declined',
  'purchase_order_created',
  'purchase_order_completed',
  'purchase_order_cancelled',
  'purchase_order_payment_recorded',
  'low_stock_alert',
  'location_created',
  'staff_added',
  'staff_deactivated',
  'order_created',
  'order_kot_fired',
  'order_preparing',
  'order_ready',
  'order_delivered',
  'order_completed',
  'order_cancelled',
];

export const NOTIFICATION_TYPE_OPTIONS: { value: NotificationType; label: string }[] =
  ALL_NOTIFICATION_TYPES.map((value) => ({ value, label: statusLabel(value) }));

export const NOTIFICATION_READ_STATUS_OPTIONS: { value: 'unread' | 'read'; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

/**
 * Date-range presets for the Notifications page toolbar, per the product
 * ask (Today / Yesterday / Last 7 days / This month / Last month) plus an
 * "All time" catch-all — same preset-driven shape as Reports'
 * `DATE_PRESET_OPTIONS` (`src/modules/reports/constants/reportsFilters.constants.ts`),
 * but its own value set since Reports' (today/week/month/range/all) has no
 * yesterday or last-month preset.
 */
export type NotificationDatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'all';

export const NOTIFICATION_DATE_PRESET_OPTIONS: { value: NotificationDatePreset; label: string }[] =
  [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 days' },
    { value: 'month', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'all', label: 'All time' },
  ];
