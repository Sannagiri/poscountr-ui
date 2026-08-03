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
  accepted: 'success',
  declined: 'danger',
  expired: 'ink',
  active: 'success',
  inactive: 'ink',
  trial: 'accent',
  suspended: 'danger',
  blocked: 'danger',
  paid: 'success',
  partial: 'warning',
  credit: 'danger',
} as const;

export type StatusKey = keyof typeof statusColorRole;

/**
 * Categorical chart palette (Reports dashboard donuts/bars) — 8 hues, fixed
 * order, validated via the dataviz skill's `validate_palette.js` against
 * this app's card surface (`#FFFFFF`): CVD-safe adjacent pairs (worst ΔE 9.1
 * light, ≥8 target), normal-vision floor 19.6 (≥15 floor). Never reassign or
 * reorder per-chart — identity (which category/payment method) has to stay
 * stable across the dashboard. Three slots (aqua/yellow/magenta) sit below
 * 3:1 contrast on a light surface by design — the mitigation is always
 * pairing them with a visible label (donut legend/% labels), never a bare
 * color swatch alone.
 */
export const categoricalPalette = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

/** Fixed slot per payment method — same order as `PAYMENT_METHOD_OPTIONS` (billing.constants.ts) so identity stays consistent between the completion-step picker and the Reports payment-mix chart. */
export const paymentMethodColorRole: Record<string, string> = {
  cash: categoricalPalette[0],
  card: categoricalPalette[1],
  upi: categoricalPalette[2],
  wallet: categoricalPalette[3],
  other: categoricalPalette[7],
};

/** Category-mix / any other nominal series pulls slots in order, capped at the 8 validated hues — a 9th distinct category folds into "Other" rather than cycling back to slot 1 (see dataviz skill, "never a generated 9th hue"). */
export function categoricalColorAt(index: number): string {
  return categoricalPalette[index % categoricalPalette.length];
}

/** Fixed slot per purchase-order payment status — semantic (paid=good, credit=owed), not arbitrary, so it uses the success/warning/danger tokens directly rather than a `categoricalColorAt` slot. */
export const purchasePaymentStatusColorRole: Record<string, string> = {
  paid: colors.success.DEFAULT,
  partial: colors.warning.DEFAULT,
  credit: colors.danger.DEFAULT,
};
