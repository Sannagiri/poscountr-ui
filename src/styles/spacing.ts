/**
 * Design tokens — spacing.
 * Centralized so every page uses the same rhythm instead of ad-hoc
 * paddings/margins (docs/coding-standards.md §2, §13).
 */
export const spacing = {
  pageX: 'px-6',
  pageY: 'py-5',
  sectionGap: 'gap-5',
  cardPadding: 'p-4',
  cardGap: 'gap-3.5',
  formFieldGap: 'gap-3.5',
} as const;

export const radius = {
  card: 'rounded-card',
  control: 'rounded-control',
  pill: 'rounded-full',
} as const;
