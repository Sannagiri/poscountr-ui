import { cn } from '@/utils/cn';

import { PAYMENT_METHOD_OPTIONS } from '../../constants/billing.constants';
import type { PaymentMethodSelection } from '../../types/billing.types';

// `PAYMENT_METHOD_OPTIONS` mirrors the backend's real `PaymentMethod.choices`
// exactly (docs/coding-standards.md §25) — 'terminal' isn't one of those
// values, so it's appended here for rendering only, not folded into that
// constant. Selecting it doesn't set a payment method directly; see
// `PaymentMethodSelection`'s own doc comment.
const GRID_OPTIONS = [...PAYMENT_METHOD_OPTIONS, { value: 'terminal', label: 'Terminal' }] as const;

/**
 * Payment method shown as small selectable cards instead of a Select dropdown — shared by New
 * Order's own completion step and Order Detail's "Complete order" modal, so both payment steps
 * look and behave the same rather than one page having its own one-off picker. Collecting payment
 * can skip the extra tap of opening a picker this way. Mirrors the mobile app's own
 * PaymentMethodGrid, plus the "Terminal" tile both web checkout screens add on top (push the
 * amount to the location's EDC/UPI machine instead of recording a method by hand).
 */
export function PaymentMethodGrid({
  value,
  onChange,
}: {
  value: PaymentMethodSelection;
  onChange: (value: PaymentMethodSelection) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-soft">Payment method</span>
      <div className="flex flex-wrap gap-2">
        {GRID_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{ minWidth: '31%' }}
              className={cn(
                'flex-1 rounded-control border px-3 py-2.5 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-white text-ink-soft hover:border-brand/40',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
