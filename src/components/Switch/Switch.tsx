import { cn } from '@/utils/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * On/off toggle for boolean settings that read better as a switch than a
 * checkbox (invoice display options, notification toggles, …) — a Metronic
 * settings screen leans on switches for exactly this kind of "on for this
 * business" flag. A plain native `<button role="switch">` rather than
 * pulling in `@radix-ui/react-switch` — the interaction (toggle on click/
 * Space/Enter, `aria-checked` state) is simple enough not to need another
 * dependency, unlike `Checkbox`'s indeterminate state which does benefit
 * from Radix's handling.
 */
export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border border-border-strong bg-border transition-colors',
        'hover:brightness-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        checked && 'border-brand bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-[22px]',
        )}
      />
    </button>
  );
}
