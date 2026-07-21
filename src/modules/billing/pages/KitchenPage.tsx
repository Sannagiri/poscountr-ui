import { useMemo, useState } from 'react';

import { Badge, Card, EmptyState, Loader, PageHeader, Select } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useAuthStore } from '@/modules/auth';
import { useLocations } from '@/modules/businesses';

import { useKdsQueue } from '../hooks/useKdsQueue';
import { billingService } from '../services/billingService';
import type { KdsOrder } from '../types/billing.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface KdsColumn {
  status: 'kot_fired' | 'preparing' | 'ready';
  title: string;
  actionLabel: string;
  call: (orderId: string) => ReturnType<typeof billingService.setPreparing>;
}

const COLUMNS: KdsColumn[] = [
  {
    status: 'kot_fired',
    title: 'KOT fired',
    actionLabel: 'Start preparing',
    call: billingService.setPreparing,
  },
  {
    status: 'preparing',
    title: 'Preparing',
    actionLabel: 'Mark ready',
    call: billingService.setReady,
  },
  { status: 'ready', title: 'Ready', actionLabel: 'Mark delivered', call: billingService.deliver },
];

/**
 * Kitchen Display board — its own nav item/page (per the F6 confirm-first
 * decision), meant to be left open full-screen on a kitchen-adjacent
 * tablet. Polls every ~4s via `useKdsQueue`'s `refetchInterval`; there's no
 * push/websocket channel yet.
 *
 * `kitchen_staff` can never reach this page (mobile-only role,
 * `WEB_ROLES` excludes it) — the only two roles that ever render this are
 * `tenant_admin` and `manager`, so this is really a monitoring/expo view
 * for them, not the kitchen's own primary tool.
 */
export function KitchenPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const locationsQuery = useLocations({ enabled: isTenantAdmin });
  const [locationId, setLocationId] = useState<string | undefined>(undefined);

  // A manager's queue is resolved server-side from their own assigned
  // location — `locationId` stays `undefined` for them and the query is
  // always enabled. A tenant_admin must explicitly pick a location first.
  const kdsQuery = useKdsQueue(locationId, { enabled: !isTenantAdmin || Boolean(locationId) });

  const locationOptions = useMemo(
    () =>
      (locationsQuery.data ?? []).map((location) => ({ value: location.id, label: location.name })),
    [locationsQuery.data],
  );

  const transitionMutation = useMutation({
    mutationFn: ({ orderId, call }: { orderId: string; call: KdsColumn['call'] }) => call(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'kds'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'orders'] });
    },
    onError: (error) => {
      // A toast here would fire ~every 4s if the underlying call keeps
      // failing (e.g. a stale card after another device already advanced
      // the same order) — the board just quietly refetches instead, the
      // stale card corrects itself once the queue reloads.
      queryClient.invalidateQueries({ queryKey: ['billing', 'kds'] });
      void describeApiError(error);
    },
  });

  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, KdsOrder[]> = { kot_fired: [], preparing: [], ready: [] };
    for (const order of kdsQuery.data ?? []) {
      (grouped[order.status] ?? (grouped[order.status] = [])).push(order);
    }
    return grouped;
  }, [kdsQuery.data]);

  return (
    <div>
      <PageHeader
        title="Kitchen"
        subtitle="Live kitchen queue — updates automatically every few seconds"
        actions={
          isTenantAdmin ? (
            <div className="w-56">
              <Select
                placeholder="Select a location"
                options={locationOptions}
                value={locationId}
                onChange={setLocationId}
              />
            </div>
          ) : undefined
        }
      />

      {isTenantAdmin && !locationId ? (
        <EmptyState
          title="Select a location"
          description="Pick a location above to see its kitchen queue."
        />
      ) : kdsQuery.isLoading ? (
        <Loader label="Loading kitchen queue…" />
      ) : kdsQuery.isError ? (
        <EmptyState
          title="Couldn't load the kitchen queue"
          description={describeApiError(kdsQuery.error)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.status} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                  {column.title}
                </p>
                <Badge tone="neutral">{ordersByStatus[column.status]?.length ?? 0}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {(ordersByStatus[column.status] ?? []).length === 0 ? (
                  <Card className="py-8 text-center text-xs text-ink-faint">Nothing here</Card>
                ) : (
                  ordersByStatus[column.status]?.map((order) => (
                    <KdsCard
                      key={order.id}
                      order={order}
                      actionLabel={column.actionLabel}
                      isLoading={
                        transitionMutation.isPending &&
                        transitionMutation.variables?.orderId === order.id
                      }
                      onAdvance={() =>
                        transitionMutation.mutate({ orderId: order.id, call: column.call })
                      }
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KdsCard({
  order,
  actionLabel,
  isLoading,
  onAdvance,
}: {
  order: KdsOrder;
  actionLabel: string;
  isLoading: boolean;
  onAdvance: () => void;
}) {
  return (
    <Card className={order.isLate ? 'border-danger/40 bg-danger-bg/40' : undefined}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-ink">
          {order.tokenNumber ? `Token #${order.tokenNumber}` : order.tableNumber || 'Order'}
        </p>
        <Badge tone={order.isLate ? 'danger' : 'neutral'}>{order.elapsedMinutes} min</Badge>
      </div>
      <ul className="mb-3 flex flex-col gap-0.5">
        {order.items.map((item, index) => (
          <li key={index} className="text-xs text-ink-soft">
            {item.quantity} × {item.name}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdvance}
        disabled={isLoading}
        className="w-full rounded-control bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {isLoading ? 'Updating…' : actionLabel}
      </button>
    </Card>
  );
}
