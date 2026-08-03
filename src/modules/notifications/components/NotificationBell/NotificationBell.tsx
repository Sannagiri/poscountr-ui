import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';

import { Drawer, EmptyState, Loader, Select } from '@/components';
import { cn } from '@/utils/cn';
import { formatTimestamp } from '@/utils/date';
import { ALL_FILTER_VALUE, applyFilterValues, hasActiveListFilters } from '@/utils/listFilter';

import type { NotificationDatePreset } from '../../constants/notification.constants';
import {
  NOTIFICATION_DATE_PRESET_OPTIONS,
  NOTIFICATION_READ_STATUS_OPTIONS,
  NOTIFICATION_TYPE_ICON,
  NOTIFICATION_TYPE_OPTIONS,
  NOTIFICATION_TYPE_TONE,
  NOTIFICATIONS_ROUTES,
} from '../../constants/notification.constants';
import { useNotificationMutations } from '../../hooks/useNotificationMutations';
import { useNotificationsList } from '../../hooks/useNotificationsList';
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';
import type { AppNotification } from '../../types/notification.types';
import { resolveDatePresetBounds } from '../../utils/resolveDatePresetBounds';
import { resolveNotificationRoute } from '../../utils/resolveNotificationRoute';

const TYPE_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: 'All types' },
  ...NOTIFICATION_TYPE_OPTIONS,
];
const STATUS_FILTER_OPTIONS = [
  { value: ALL_FILTER_VALUE, label: 'All status' },
  ...NOTIFICATION_READ_STATUS_OPTIONS,
];

/**
 * The Topbar bell: unread badge (polled every 5s, see
 * `useUnreadNotificationCount`) + a right-side `Drawer` listing the caller's
 * own notifications, sharing `NotificationsPage`'s own `useNotificationsList`
 * data source (server-filtered by date range) so the date-preset filter here
 * actually broadens/narrows what's fetched instead of just slicing a fixed
 * recent batch. Opening it marks everything in view read automatically — no
 * extra click. `unreadOnOpen` freezes which rows looked unread at the moment
 * it opened, so they don't lose their highlight mid-glance once the
 * mark-all-read call resolves underneath — which also means the "Unread"
 * status filter below will usually come up empty once you've had the panel
 * open a moment; it's kept for the rare case a new one arrives while you're
 * still looking. Each row's own "View" action reuses
 * `resolveNotificationRoute` — the same deep-link map `NotificationsPage`
 * uses — so the two surfaces never drift on where a given event type goes.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  const [datePreset, setDatePreset] = useState<NotificationDatePreset>('week');
  const dateBounds = useMemo(() => resolveDatePresetBounds(datePreset), [datePreset]);
  // Fetched only once the drawer is actually opened, not on every mount.
  const { data: notifications, isLoading } = useNotificationsList(dateBounds, open);
  const { markRead, markAllRead } = useNotificationMutations();

  const [unreadOnOpen, setUnreadOnOpen] = useState<Set<string>>(new Set());
  const capturedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      capturedRef.current = false;
      return;
    }
    if (capturedRef.current || !notifications) return;
    capturedRef.current = true;
    setUnreadOnOpen(
      new Set(notifications.filter((notification) => !notification.isRead).map((n) => n.id)),
    );
    if (notifications.some((notification) => !notification.isRead)) {
      markAllRead.mutate();
    }
    // markAllRead is a stable useMutation result; only re-run when the drawer opens with fresh data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notifications]);

  const [typeFilter, setTypeFilter] = useState(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);

  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    return applyFilterValues(
      notifications,
      [
        { key: 'notificationType' },
        { key: 'isRead', getValue: (row) => (row.isRead ? 'read' : 'unread') },
      ],
      { notificationType: typeFilter, isRead: statusFilter },
    );
  }, [notifications, typeFilter, statusFilter]);

  const filtersActive = hasActiveListFilters('', {
    notificationType: typeFilter,
    isRead: statusFilter,
  });

  function clearFilters() {
    setTypeFilter(ALL_FILTER_VALUE);
    setStatusFilter(ALL_FILTER_VALUE);
  }

  function goToNotification(notification: AppNotification) {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    const route = resolveNotificationRoute(notification);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface hover:text-ink"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Notifications"
        footer={
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(NOTIFICATIONS_ROUTES.notifications);
            }}
            className="w-full text-center text-xs font-semibold text-accent hover:underline"
          >
            View all notifications
          </button>
        }
      >
        <div className="sticky top-0 z-10 -mt-4 mb-4 flex flex-col gap-1.5 bg-white pb-3 pt-4">
          <div className="flex items-center gap-2">
            {/* Sizing lives on this wrapper, not Select's own className — Select's trigger sits inside
                its own `flex flex-col` wrapper, where `flex-1`/`min-w-0` would size *height*, not width. */}
            <div className="min-w-0 flex-1">
              <Select
                className="h-9 px-2 text-xs"
                value={datePreset}
                onChange={(value) => setDatePreset(value as NotificationDatePreset)}
                options={NOTIFICATION_DATE_PRESET_OPTIONS}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Select
                className="h-9 px-2 text-xs"
                value={typeFilter}
                onChange={setTypeFilter}
                options={TYPE_FILTER_OPTIONS}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Select
                className="h-9 px-2 text-xs"
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="self-start text-[11px] font-semibold text-accent hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader size="sm" />
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="flex flex-col">
            {filteredNotifications.map((notification) => {
              const Icon = NOTIFICATION_TYPE_ICON[notification.notificationType];
              const isUnread = unreadOnOpen.has(notification.id);
              const route = resolveNotificationRoute(notification);
              return (
                <div
                  key={notification.id}
                  className={cn(
                    '-mx-5 flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0',
                    isUnread && 'bg-accent/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      NOTIFICATION_TYPE_TONE[notification.notificationType],
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  <button
                    type="button"
                    onClick={() => goToNotification(notification)}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      {isUnread ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      ) : null}
                      <span className="truncate">{notification.title}</span>
                    </span>
                    {notification.message ? (
                      <span className="truncate text-xs text-ink-soft">{notification.message}</span>
                    ) : null}
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-faint">
                      <span>{formatTimestamp(notification.createdAt)}</span>
                      {notification.actorName ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{notification.actorName}</span>
                        </>
                      ) : null}
                    </span>
                  </button>
                  {route ? (
                    <button
                      type="button"
                      onClick={() => goToNotification(notification)}
                      className="flex shrink-0 items-center gap-0.5 rounded-control border border-border px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:border-accent hover:text-accent"
                    >
                      View
                      <ChevronRight size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={
              notifications && notifications.length > 0
                ? 'No matches'
                : 'No notifications in this range'
            }
            description={
              notifications && notifications.length > 0
                ? 'Try clearing the filters.'
                : 'Try a wider date range, or check back once something happens.'
            }
          />
        )}
      </Drawer>
    </>
  );
}
