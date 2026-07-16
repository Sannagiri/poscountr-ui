import { cn } from '@/utils/cn';

import { PIN_LENGTH } from '../../constants/auth.constants';

export interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** `dark` (default) is for use on a dark-navy surface (ChangePinPage); `light` for a white card (LoginPage's form panel). */
  variant?: 'dark' | 'light';
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/**
 * Numeric PIN entry pad for staff login and change-PIN — large touch
 * targets since the primary device is an Android tablet at the counter
 * (posflow-conception.md §2). Specific to the auth module, not promoted to
 * the shared component library (docs/coding-standards.md §4).
 */
export function PinPad({ value, onChange, disabled = false, variant = 'dark' }: PinPadProps) {
  const isDark = variant === 'dark';

  function handleKeyPress(key: string) {
    if (disabled || key === '') return;
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length < PIN_LENGTH) {
      onChange(value + key);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-center gap-2.5" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              index < value.length ? 'bg-brand' : isDark ? 'bg-white/10' : 'bg-border',
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="PIN keypad">
        {KEYS.map((key, index) => (
          <button
            key={`${key}-${index}`}
            type="button"
            disabled={disabled || key === ''}
            onClick={() => handleKeyPress(key)}
            aria-label={key === '⌫' ? 'Backspace' : key === '' ? undefined : `Digit ${key}`}
            className={cn(
              'rounded-control py-3 font-display text-base font-bold disabled:opacity-0',
              isDark
                ? 'bg-white/5 text-white enabled:hover:bg-white/10'
                : 'bg-surface text-ink enabled:hover:bg-border/60',
            )}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
