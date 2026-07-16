/**
 * Design tokens — colors.
 *
 * Mirrors `tailwind.config.js` (the canonical source, see the comment at the
 * top of that file). Import from here only when a raw hex value is genuinely
 * needed in JS/TS — inline SVG fills, canvas/chart libraries that can't take
 * a Tailwind class. Everywhere else, use Tailwind utility classes
 * (`bg-brand`, `text-danger`, …) so a palette change never requires touching
 * component code (docs/coding-standards.md §2).
 */
export const colors = {
  brand: { DEFAULT: '#FF6B2B', light: '#FF8C5A', dark: '#CC4A10' },
  accent: { DEFAULT: '#1A5FD4', light: '#4D8EFF', dark: '#0D3FA0' },
  ink: { DEFAULT: '#0A0E1A', mid: '#1C2333', soft: '#4B5563', faint: '#9CA3AF' },
  surface: { DEFAULT: '#F5F7FF', card: '#FFFFFF' },
  border: { DEFAULT: '#E4E8F4', strong: '#C7CEE6' },
  success: { DEFAULT: '#10B981', bg: '#D1FAE5', text: '#065F46' },
  warning: { DEFAULT: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
  danger: { DEFAULT: '#EF4444', bg: '#FEE2E2', text: '#991B1B' },
  navy: {
    DEFAULT: '#0B1222',
    deep: '#07090F',
    panel: '#0D1220',
    card: '#111830',
    topbar: '#1C2740',
  },
} as const;

/** Status → color-role mapping shared by every status pill/badge in the app. */
export const statusColorRole = {
  pending: 'warning',
  kot_fired: 'accent',
  preparing: 'accent',
  ready: 'success',
  delivered: 'ink',
  completed: 'success',
  cancelled: 'danger',
  active: 'success',
  inactive: 'ink',
  trial: 'accent',
  suspended: 'danger',
  blocked: 'danger',
} as const;

export type StatusKey = keyof typeof statusColorRole;
