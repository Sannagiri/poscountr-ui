/**
 * Single import point for every design token module — the "theme
 * configuration" file called for in docs/coding-standards.md §2.
 *
 * Usage: `import { theme } from '@/styles/theme'`.
 */
import { breakpoints } from './breakpoints';
import { colors, statusColorRole } from './colors';
import { radius, spacing } from './spacing';
import { fontFamily, typeScale } from './typography';

export const theme = {
  colors,
  statusColorRole,
  fontFamily,
  typeScale,
  spacing,
  radius,
  breakpoints,
} as const;

export type Theme = typeof theme;
