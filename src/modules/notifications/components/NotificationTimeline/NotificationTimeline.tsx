import { cn } from '@/utils/cn';
import { dateIST, formatTimestamp, toISTDate } from '@/utils/date';

import {
  NOTIFICATION_TYPE_ICON,
  NOTIFICATION_TYPE_TONE,
} from '../../constants/notification.constants';
import type { AppNotification } from '../../types/notification.types';

/** No year — this timeline only ever shows the current year's activity in practice, so it'd just be noise. */
function dayLabel(isoDay: string): string {
  if (isoDay === dateIST()) return 'Today';
  if (isoDay === dateIST(-1)) return 'Yesterday';
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

interface DayGroup {
  day: string;
  label: string;
  items: AppNotification[];
}

/** Buckets an already newest-first list into day sections — never re-sorts, just groups the existing order. */
function groupByDay(notifications: AppNotification[]): DayGroup[] {
  const order: string[] = [];
  const byDay = new Map<string, AppNotification[]>();
  for (const notification of notifications) {
    const day = toISTDate(notification.createdAt);
    if (!byDay.has(day)) {
      byDay.set(day, []);
      order.push(day);
    }
    byDay.get(day)!.push(notification);
  }
  return order.map((day) => ({ day, label: dayLabel(day), items: byDay.get(day)! }));
}

export interface NotificationTimelineProps {
  notifications: AppNotification[];
  onSelect: (notification: AppNotification) => void;
}

/**
 * A vertical activity timeline — icon-per-event, a connecting line, grouped
 * by day — instead of a routine data-grid. This is a "who did what, when"
 * audit trail; a timeline reads that story far more naturally than rows in
 * a table (same idea as a typical account-activity screen).
 */
export function NotificationTimeline({ notifications, onSelect }: NotificationTimelineProps) {
  const groups = groupByDay(notifications);

  return (
    <div className="relative">
      <div className="absolute bottom-2 left-[22px] top-2 w-px bg-border" aria-hidden="true" />
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.day}>
            <div className="relative z-10 mb-2 ml-12 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((notification) => {
                const Icon = NOTIFICATION_TYPE_ICON[notification.notificationType];
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => onSelect(notification)}
                    className={cn(
                      'group relative z-10 flex w-full items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface',
                      !notification.isRead && 'bg-accent/5 hover:bg-accent/10',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-white',
                        NOTIFICATION_TYPE_TONE[notification.notificationType],
                      )}
                    >
                      <Icon size={13} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {!notification.isRead ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        ) : null}
                        <span className="truncate">{notification.title}</span>
                      </span>
                      {notification.message ? (
                        <span className="truncate text-xs text-ink-soft">
                          {notification.message}
                        </span>
                      ) : null}
                      <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-faint">
                        <span>{formatTimestamp(notification.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{notification.locationName ?? 'Tenant-wide'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{notification.actorName ?? 'System'}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
