import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/utils/cn';

import * as RadixSelect from '@radix-ui/react-select';

export interface SelectOption {
  value: string;
  label: string;
  /** Shown but not selectable — e.g. a license plan that's been deactivated. */
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  errorMessage?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** For a native form to still submit a value (e.g. no-JS fallback) — rarely needed. */
  required?: boolean;
}

/**
 * The one dropdown every screen uses — fully custom-styled (not the
 * browser's native `<select>` popover, which can't be themed and looks
 * inconsistent across OS/browser). Built on `@radix-ui/react-select` for
 * accessible keyboard nav/focus handling; every visual piece (trigger,
 * popover, options, selected state) is our own markup so it always matches
 * the rest of the app (docs/coding-standards.md §18).
 *
 * Controlled (`value`/`onChange`) rather than a native form element — it
 * has no underlying `<select>` DOM node for `register()` to attach a ref to,
 * so React Hook Form usages wire it up via `Controller` instead
 * (see `CreateBusinessModal` for the pattern).
 */
export function Select({
  label,
  errorMessage,
  hint,
  options,
  placeholder = 'Select…',
  value,
  onChange,
  onBlur,
  name,
  id,
  disabled,
  className,
  required,
}: SelectProps) {
  const selectId = id ?? name;
  const hasError = Boolean(errorMessage);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
      ) : null}
      <RadixSelect.Root
        value={value}
        onValueChange={onChange}
        onOpenChange={(open) => {
          if (!open) onBlur?.();
        }}
        name={name}
        disabled={disabled}
        required={required}
      >
        <RadixSelect.Trigger
          id={selectId}
          aria-invalid={hasError}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-white px-3 text-sm text-ink transition-colors',
            'hover:border-border-strong',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[placeholder]:text-ink-faint',
            hasError ? 'border-danger' : 'border-border',
            className,
          )}
        >
          <span className="truncate">
            <RadixSelect.Value placeholder={placeholder}>{selectedLabel}</RadixSelect.Value>
          </span>
          <RadixSelect.Icon asChild>
            <ChevronDown size={15} className="shrink-0 text-ink-faint" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-64 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control border border-border bg-white shadow-dropdown"
          >
            <RadixSelect.Viewport className="scrollbar-thin p-1">
              {options.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-ink-faint">No options</p>
              ) : (
                options.map((option) => (
                  <RadixSelect.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-[6px] px-2.5 py-2 pr-7 text-sm text-ink outline-none',
                      'data-[highlighted]:bg-surface data-[state=checked]:font-semibold data-[state=checked]:text-brand',
                      'data-[disabled]:cursor-not-allowed data-[disabled]:data-[highlighted]:bg-transparent data-[disabled]:text-ink-faint',
                    )}
                  >
                    <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator className="absolute right-2.5 inline-flex items-center">
                      <Check size={14} />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                ))
              )}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {hasError ? (
        <p className="text-xs text-danger">{errorMessage}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
