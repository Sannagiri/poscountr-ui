import { useCallback, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'poscountr.theme';

export type Theme = 'light' | 'dark';

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark() ? 'dark' : 'light';
}

/** Adds/removes the `dark` class `index.html`'s own inline script already applied pre-mount — kept in sync here so a later toggle (or a live OS theme change) updates it too, not just the very first paint. */
function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * The single source of truth for light/dark — `index.html`'s inline script
 * makes the *first* paint match this same decision (see that file's own
 * comment) so there's no flash-of-wrong-theme between page load and React
 * mounting; this hook is what every component actually reads/sets from
 * after that, and it's what keeps the OS-level system preference honored
 * live for as long as the user hasn't explicitly picked a theme of their
 * own (an explicit pick is remembered in `localStorage` and wins from then
 * on, same "manual choice overrides the ambient default" precedent this
 * app already uses for its `feedback` memories). Every mounted instance
 * shares one `dark` class on `<html>`, so multiple components calling this
 * hook never fight each other.
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setThemeState(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
