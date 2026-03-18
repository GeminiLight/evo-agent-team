import { useState, useEffect } from 'react';

/**
 * Reactive CSS media query hook.
 * Returns true when the query matches, re-renders on change.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);           // sync in case SSR initial was wrong
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/* ── Presets ── */

/** ≤767px — phone / very narrow */
export const useIsMobile  = () => useMediaQuery('(max-width: 767px)');

/** ≤1023px — tablet portrait / split-screen */
export const useIsTablet  = () => useMediaQuery('(max-width: 1023px)');

/** ≤1199px — tablet landscape / narrow desktop window */
export const useIsCompact = () => useMediaQuery('(max-width: 1199px)');
