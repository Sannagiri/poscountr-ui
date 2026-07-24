/**
 * A plain in-memory key→value store, module-scoped rather than component-
 * scoped — it survives client-side route navigation (the page component
 * that reads/writes it unmounts and remounts; this module doesn't) but
 * resets on an actual browser reload, unlike `localStorage`/`sessionStorage`
 * which would also survive a reload. Used for "remember my filters/
 * selections until I reload or clear them" UI state (`DataTable`'s search/
 * filters, `NewOrderPage`'s business/location/order-type pickers) — state
 * that should feel sticky while navigating around the app but never leak
 * into a fresh session.
 */
const store = new Map<string, unknown>();

export function getSessionMemory<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setSessionMemory<T>(key: string, value: T): void {
  store.set(key, value);
}
