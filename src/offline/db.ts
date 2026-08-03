import Dexie, { type Table } from 'dexie';

import type { OfflineOrderSyncRequest } from '@/modules/billing/types/billing.types';
import type { Product } from '@/modules/inventory';

/** One register-offline cash sale, queued for `POST /tenant/orders/offline-sync/`. */
export interface PendingOrder {
  /** Also the payload's `idempotencyKey` — the one thing that makes a retried sync call safe. */
  localId: string;
  payload: OfflineOrderSyncRequest;
  status: 'queued' | 'syncing' | 'synced' | 'failed';
  createdAt: number;
  lastError?: string;
  syncedOrderId?: string;
}

/**
 * Last-known product list for one location, opportunistically refreshed
 * whenever `NewOrderPage` fetches it online — the only "offline read" this
 * feature needs, so the product grid isn't blank if the app reloads mid
 * outage. `key` is the location id (or `'__all__'` when no location scoping
 * applies yet).
 */
export interface ProductCacheEntry {
  key: string;
  products: Product[];
  cachedAt: number;
}

class OfflineDb extends Dexie {
  pendingOrders!: Table<PendingOrder, string>;
  productCache!: Table<ProductCacheEntry, string>;

  constructor() {
    super('poscountr-offline');
    this.version(1).stores({
      // `createdAt` indexed — the sync engine always replays oldest-first.
      pendingOrders: 'localId, status, createdAt',
      productCache: 'key',
    });
  }
}

export const offlineDb = new OfflineDb();

/**
 * The pending-sync badge (`usePendingOrderCount`) and the sync engine both
 * need to react to the queue changing size, without a further dependency
 * (dexie-react-hooks) or a global store — a plain DOM event is enough for
 * this one, narrow signal.
 */
const QUEUE_CHANGED_EVENT = 'poscountr:offline-queue-changed';

export function notifyQueueChanged(): void {
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

export function onQueueChanged(listener: () => void): () => void {
  window.addEventListener(QUEUE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(QUEUE_CHANGED_EVENT, listener);
}
