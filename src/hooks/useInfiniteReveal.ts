import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

export interface UseInfiniteRevealOptions {
  /** Total number of items currently available to reveal (post search/filter). */
  totalCount: number;
  /** How many items to render initially and per additional batch. Default 25. */
  batchSize?: number;
  /**
   * Revealed count resets back to `batchSize` whenever this value changes —
   * pass something that changes when the underlying result set does (e.g. a
   * search term + serialized filter values), so a fresh search/filter starts
   * from the top instead of preserving however far the previous one had
   * scrolled.
   */
  resetKey?: string | number;
  /**
   * The element that actually scrolls, if it's not the app's page-level
   * scroll area. Omit for a list that scrolls with the page (e.g.
   * `TenantCardGrid`) — the sentinel's nearest `[data-scroll-root]` ancestor
   * (`AppShell`'s `<main>`) is used automatically. Pass this when the caller
   * owns its own fixed-height scroll box instead (`DataTable`, sized to fill
   * the remaining viewport by `useFillRemainingHeight`) — observing against
   * the page would never fire, since that box scrolls internally and the
   * page itself doesn't.
   */
  rootRef?: RefObject<HTMLElement | null>;
}

/**
 * Shared "reveal more as you scroll" behavior for both `DataTable` and
 * `TenantCardGrid` — every list in this app is fetched as one already-loaded
 * array (no backend pagination contract exists), so this is a client-side
 * reveal over data already in memory, not a series of network fetches.
 *
 * The caller renders a sentinel element (any empty `<div ref={sentinelRef} />`
 * works) at the bottom of whatever's currently rendered; an
 * `IntersectionObserver` grows `visibleCount` by `batchSize` each time that
 * sentinel scrolls into view.
 */
export function useInfiniteReveal({
  totalCount,
  batchSize = 25,
  resetKey,
  rootRef,
}: UseInfiniteRevealOptions) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(batchSize);
    // `resetKey` is the whole point of this effect; `batchSize` rarely
    // changes but is included for correctness if a caller ever varies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, batchSize]);

  const hasMore = visibleCount < totalCount;

  useEffect(() => {
    if (!hasMore) return undefined;
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const scrollRoot = rootRef?.current ?? sentinel.closest('[data-scroll-root]');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + batchSize, totalCount));
        }
      },
      { root: scrollRoot, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, batchSize, totalCount, rootRef]);

  return { visibleCount, sentinelRef, hasMore };
}
