import { Check, Minus } from 'lucide-react';

import { cn } from '@/utils/cn';

import * as RadixCheckbox from '@radix-ui/react-checkbox';

export interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * The one checkbox every screen uses — currently the row/select-all control
 * in `DataTable`, built to be generic from the start rather than a one-off
 * inline `<input type="checkbox">` (same "build it as a component, used
 * everywhere" pattern as `DatePicker`). Built on `@radix-ui/react-checkbox`
 * for accessible state/keyboard handling; the box and check glyph are this
 * component's own markup.
 */
export function Checkbox({ checked, onCheckedChange, label, disabled, className }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong bg-white transition-colors',
        'hover:border-brand',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        'data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <RadixCheckbox.Indicator className="flex items-center justify-center text-white">
        {checked === 'indeterminate' ? (
          <Minus size={11} strokeWidth={3} />
        ) : (
          <Check size={11} strokeWidth={3} />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
