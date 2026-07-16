/**
 * Design tokens — typography.
 * Mirrors `tailwind.config.js`. See `colors.ts` for the token-usage rule.
 */
export const fontFamily = {
  sans: "'Inter', sans-serif",
  display: "'Plus Jakarta Sans', sans-serif",
} as const;

/** Semantic type scale — every heading/body element in the app maps to one of these. */
export const typeScale = {
  pageTitle: 'font-display font-extrabold text-xl tracking-tight text-ink',
  sectionTitle: 'font-display font-extrabold text-sm text-ink',
  statValue: 'font-display font-extrabold text-2xl text-ink',
  body: 'font-sans text-sm text-ink',
  bodyMuted: 'font-sans text-sm text-ink-soft',
  caption: 'font-sans text-xs text-ink-faint',
  label: 'font-sans text-xs font-medium text-ink-soft',
} as const;
