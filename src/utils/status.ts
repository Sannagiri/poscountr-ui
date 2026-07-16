import type { BadgeTone } from '@/components/Badge';
import type { StatusKey } from '@/styles/colors';
import { statusColorRole } from '@/styles/colors';

const ROLE_TO_TONE: Record<(typeof statusColorRole)[StatusKey], BadgeTone> = {
  warning: 'warning',
  accent: 'accent',
  success: 'success',
  danger: 'danger',
  ink: 'neutral',
};

/**
 * Maps a backend status string (order status, license status, …) to the
 * `Badge` tone that renders it — the single place that decision lives, so
 * every list/table/detail screen shows the same color for the same status
 * (docs/coding-standards.md §12, §13).
 */
export function toneForStatus(status: string): BadgeTone {
  const key = status as StatusKey;
  const role = statusColorRole[key];
  return role ? ROLE_TO_TONE[role] : 'neutral';
}

/**
 * Converts a `snake_case` backend status into a sentence-case label
 * ("kot_fired" -> "Kot fired") — sentence case throughout the UI, never
 * Title Case (docs/coding-standards.md §13, "UI consistency").
 */
export function statusLabel(status: string): string {
  const words = status.split('_');
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}
