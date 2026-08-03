import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, RefreshCw } from 'lucide-react';

import {
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  ListToolbar,
  Loader,
  PageHeader,
  Select,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import {
  ALL_FILTER_VALUE,
  applyFilterValues,
  filterBySearch,
  hasActiveListFilters,
} from '@/utils/listFilter';

import { NotificationTimeline } from '../components/NotificationTimeline';
import type { NotificationDatePreset } from '../constants/notification.constants';
import {
  NOTIFICATION_DATE_PRESET_OPTIONS,
  NOTIFICATION_READ_STATUS_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
} from '../constants/notification.constants';
import { useNotificationMutations } from '../hooks/useNotificationMutations';
import { useNotificationsList } from '../hooks/useNotificationsList';
import type { AppNotification } from '../types/notification.types';
import { getNotificationSearchValue } from '../utils/getNotificationSearchValue';
import { resolveDatePresetBounds } from '../utils/resolveDatePresetBounds';
import { resolveNotificationRoute } from '../utils/resolveNotificationRoute';

/**
 * The full activity log — every notification the caller was ever fanned
 * out to. Date range is a server-side filter (bounds an otherwise-unbounded
 * fetch, see `useNotificationsList`); type/read-status and search narrow
 * client-side over that fetch using the same `listFilter` helpers `DataTable`
 * itself uses internally, via `ListToolbar` directly — this page renders a
 * `NotificationTimeline` instead of `DataTable`'s grid, since a "who did
 * what, when" audit trail reads far more naturally as a timeline than as
 * routine table rows. Clicking an entry marks it read and deep-links to
 * whatever it's about, via the same `resolveNotificationRoute` the Topbar
 * bell uses.
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const [datePreset, setDatePreset] = useState<NotificationDatePreset>('week');
  const dateBounds = useMemo(() => resolveDatePresetBounds(datePreset), [datePreset]);
  const notificationsQuery = useNotificationsList(dateBounds);
  const { markRead, markAllRead } = useNotificationMutations();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);

  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const hasUnread = notifications.some((notification) => !notification.isRead);

  const filteredNotifications = useMemo(() => {
    const searched = filterBySearch(notifications, searchTerm, getNotificationSearchValue);
    return applyFilterValues(
      searched,
      [
        { key: 'notificationType' },
        { key: 'isRead', getValue: (row) => (row.isRead ? 'read' : 'unread') },
      ],
      { notificationType: typeFilter, isRead: statusFilter },
    );
  }, [notifications, searchTerm, typeFilter, statusFilter]);

  function handleSelect(notification: AppNotification) {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    const route = resolveNotificationRoute(notification);
    if (route) {
      navigate(route);
    }
  }

  function clearFilters() {
    setSearchTerm('');
    setTypeFilter(ALL_FILTER_VALUE);
    setStatusFilter(ALL_FILTER_VALUE);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Everything that's happened across your businesses — who did what, and when"
        actions={
          hasUnread ? (
            <Button
              variant="secondary"
              leadingIcon={<CheckCheck size={14} />}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search notifications…"
        leading={
          <>
            <Select
              className="w-auto min-w-[9.5rem]"
              value={datePreset}
              onChange={(value) => setDatePreset(value as NotificationDatePreset)}
              options={NOTIFICATION_DATE_PRESET_OPTIONS}
            />
            <button
              type="button"
              aria-label="Refresh"
              onClick={() => notificationsQuery.refetch()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border text-ink-soft hover:bg-surface hover:text-ink"
            >
              <RefreshCw size={14} />
            </button>
          </>
        }
        filters={[
          {
            key: 'notificationType',
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: NOTIFICATION_TYPE_OPTIONS,
          },
          {
            key: 'isRead',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: NOTIFICATION_READ_STATUS_OPTIONS,
          },
        ]}
        hasActiveFilters={hasActiveListFilters(searchTerm, {
          notificationType: typeFilter,
          isRead: statusFilter,
        })}
        onClear={clearFilters}
      />

      <Card className="p-5">
        {notificationsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader label="Loading…" />
          </div>
        ) : notificationsQuery.isError ? (
          <ErrorMessage
            message={describeApiError(notificationsQuery.error)}
            onRetry={() => notificationsQuery.refetch()}
          />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            title={notifications.length === 0 ? 'No notifications in this range' : 'No matches'}
            description={
              notifications.length === 0
                ? 'Try a wider date range, or check back once something happens.'
                : 'Try clearing the search or filters.'
            }
          />
        ) : (
          <NotificationTimeline notifications={filteredNotifications} onSelect={handleSelect} />
        )}
      </Card>
    </div>
  );
}
