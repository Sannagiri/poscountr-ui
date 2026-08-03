import { describeApiError } from '@/utils/errors';

import { billingService } from '@/modules/billing/services/billingService';

import { notifyQueueChanged, offlineDb } from './db';

import type { QueryClient } from '@tanstack/react-query';

let syncInFlight = false;

/**
 * Replay every queued (or previously failed) offline sale against
 * `/tenant/orders/offline-sync/`, oldest first, one at a time — never
 * `Promise.all`, so sales land in the order they were actually made.
 *
 * Token refresh is deliberately *not* handled here: `apiClient`'s own
 * response interceptor already refreshes once and retries the original
 * request on a `token_expired` 401 (src/services/apiClient.ts) — duplicating
 * that here would risk a second concurrent refresh attempt, which the
 * backend's strict single-use rotation treats as token reuse and revokes the
 * whole session for. If the session was actually revoked while offline, the
 * request rejects, this item is marked `failed` and stays in the queue
 * (visible in the pending-sync badge), and the same interceptor's
 * `onSessionExpired` has already routed the user to log in again — the next
 * sync pass (manual "sync now", or the next `online` event) picks it up.
 *
 * Single-flight: a second call while one is already running is a no-op, so
 * the `online` event and a manual "sync now" click can't race each other.
 */
export async function runSync(queryClient: QueryClient): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    const pending = await offlineDb.pendingOrders
      .where('status')
      .anyOf('queued', 'failed')
      .sortBy('createdAt');

    let syncedAny = false;
    for (const item of pending) {
      await offlineDb.pendingOrders.update(item.localId, { status: 'syncing' });
      notifyQueueChanged();
      try {
        const { order } = await billingService.syncOfflineOrder(item.payload);
        await offlineDb.pendingOrders.update(item.localId, {
          status: 'synced',
          syncedOrderId: order.id,
        });
        syncedAny = true;
      } catch (error) {
        await offlineDb.pendingOrders.update(item.localId, {
          status: 'failed',
          lastError: describeApiError(error),
        });
      }
      notifyQueueChanged();
    }

    if (syncedAny) {
      // The now-real orders/stock/invoices need to show up everywhere they're
      // read — prefix-invalidate each module's whole key space (BILLING_QUERY_KEYS/
      // INVENTORY_QUERY_KEYS/REPORTS_QUERY_KEYS all nest under these root
      // segments) rather than trying to name every specific filtered key.
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  } finally {
    syncInFlight = false;
  }
}
