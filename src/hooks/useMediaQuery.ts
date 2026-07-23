import { useEffect, useState } from 'react';

/**
 * Tracks whether a `matchMedia` query currently matches — the JS-side
 * counterpart to a Tailwind responsive prefix, for the rare case a component
 * needs to branch its actual rendered structure (not just show/hide via
 * classes) by viewport, e.g. a fixed-height desktop layout that would trap
 * scroll on a phone. Pair with `breakpoints` (`@/styles/breakpoints`) for the
 * query string, e.g. `` `(min-width: ${breakpoints.lg}px)` ``.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const listener = () => setMatches(mql.matches);
    listener();
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
