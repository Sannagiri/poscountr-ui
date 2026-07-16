import type { RefObject } from 'react';
import { useLayoutEffect, useState } from 'react';

export interface UseFillRemainingHeightOptions {
  /** Never shrinks below this, even on a very short viewport. Default `240`. */
  minHeight?: number;
  /** Breathing room left between the element's bottom and the viewport's bottom edge. Default `24`. */
  bottomOffset?: number;
}

/**
 * Measures how much vertical space is left below an element's current
 * position and returns a pixel height that fills exactly down to the
 * bottom of the viewport — the same box ends up taller on a 27" monitor
 * than on a laptop screen, because it's computed from the actual
 * `window.innerHeight` and the element's real on-screen position (whatever
 * sits above it — page header, toolbar, breadcrumb — is accounted for
 * automatically, since that's what `getBoundingClientRect().top` reflects),
 * instead of a fixed rem value that was either too short on a big screen or
 * too tall on a small one.
 *
 * Built for `DataTable`'s row area: a fixed-height box so only the table's
 * own content scrolls (via `useInfiniteReveal`), not the whole page.
 * Recomputes on window resize; `useLayoutEffect` (not `useEffect`) so the
 * first real measurement lands before paint instead of flashing a fallback
 * height first.
 */
export function useFillRemainingHeight(
  ref: RefObject<HTMLElement | null>,
  { minHeight = 240, bottomOffset = 24 }: UseFillRemainingHeightOptions = {},
): number {
  const [height, setHeight] = useState(minHeight);

  // Deliberately no dependency array — re-measures after *every* render,
  // not just when `minHeight`/`bottomOffset` change. That matters because
  // the element behind `ref` often doesn't exist yet on an earlier render
  // (e.g. `DataTable` renders a `Loader` in place of the real table while
  // loading) — a ref mounting for the first time doesn't retrigger an
  // effect keyed on the (unchanged) `ref` object itself, so without this
  // the height would never get computed once the real content appears.
  // The work here (one `getBoundingClientRect()` call) is cheap enough that
  // running it on every render is not a performance concern.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    function recalculate() {
      if (!element) return;
      const top = element.getBoundingClientRect().top;
      setHeight(Math.max(minHeight, window.innerHeight - top - bottomOffset));
    }

    recalculate();
    window.addEventListener('resize', recalculate);
    // Sibling content (a toolbar wrapping to a second line, an error/empty
    // state swapping in) can shift this element's top offset after the
    // first paint — one more pass on the next frame catches that.
    const raf = requestAnimationFrame(recalculate);
    return () => {
      window.removeEventListener('resize', recalculate);
      cancelAnimationFrame(raf);
    };
  });

  return height;
}
