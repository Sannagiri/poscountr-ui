import { cn } from '@/utils/cn';

import { PAYMENT_METHOD_OPTIONS } from '../../constants/billing.constants';
import type { PaymentMethod } from '../../types/billing.types';

/**
 * Payment method shown as small selectable cards instead of a Select dropdown — shared by New
 * Order's own completion step and Order Detail's "Complete order" modal, so both payment steps
 * look and behave the same rather than one page having its own one-off picker. Five options is
 * few enough to show all at once, so collecting payment can skip the extra tap of opening a
 * picker. Mirrors the mobile app's own PaymentMethodGrid.
 */
export function PaymentMethodGrid({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-soft">Payment method</span>
      <div className="flex flex-wrap gap-2">
        {PAYMENT_METHOD_OPTIONS.map((option) => {
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
