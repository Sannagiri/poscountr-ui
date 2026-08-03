import { Ban, Check } from 'lucide-react';

import { cn } from '@/utils/cn';

import type { TableColorTheme } from '../../types/documentLayouts.types';

export interface ColorSwatchPickerProps {
  value: TableColorTheme;
  onChange: (value: TableColorTheme) => void;
  label?: string;
  className?: string;
}

/**
 * One swatch per `TABLE_COLOR_THEMES` value — hex values match
 * `tableRenderer.ts`'s own `TABLE_COLOR_THEMES` RGB rule colors exactly
 * (`mono`'s plain gray reproduces `doc.setDrawColor(160)`; the other four
 * are Tailwind's own 500/600 shades, the same picks that file's own doc
 * comment flags as "this task's own reasonable RGB picks") — so what a
 * business sees here is what the item table's header rule actually looks
 * like in the rendered PDF, not an approximation.
 *
 * No Radix precedent for a swatch picker exists in this repo (`Switch.tsx`
 * is the closest sibling for styling conventions — border/focus-ring/
 * transition treatment borrowed from there) — plain Tailwind buttons in a
 * `role="radiogroup"` is simple enough not to need `@radix-ui/react-*`,
 * same reasoning `Switch.tsx`'s own doc comment gives for skipping Radix.
 */
/** `hex: null` (the `none` theme) renders a `Ban` icon over a white swatch instead of a solid fill — there's no color to swatch, so a `Check` overlay (which relies on contrast against a solid fill) wouldn't read as "selected" the way it does for every other swatch. */
const SWATCHES: { value: TableColorTheme; label: string; hex: string | null }[] = [
  { value: 'none', label: 'No color (plain black-on-white)', hex: null },
  { value: 'mono', label: 'Mono (grayscale)', hex: '#a0a0a0' },
  { value: 'slate', label: 'Slate', hex: '#64748b' },
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'green', label: 'Green', hex: '#22c55e' },
  { value: 'amber', label: 'Amber', hex: '#d97706' },
];

export function ColorSwatchPicker({ value, onChange, label, className }: ColorSwatchPickerProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? <span className="text-xs font-semibold text-ink-soft">{label}</span> : null}
      <div
        role="radiogroup"
        aria-label={label ?? 'Table color theme'}
        className="flex flex-wrap gap-2.5"
      >
        {SWATCHES.map((swatch) => {
          const checked = value === swatch.value;
          return (
            <button
              key={swatch.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={swatch.label}
              title={swatch.label}
              onClick={() => onChange(swatch.value)}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-surface transition-transform',
                'hover:scale-105',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1',
                checked
                  ? 'border-ink shadow-sm'
                  : swatch.hex
                    ? 'border-transparent'
                    : 'border-border',
              )}
              style={swatch.hex ? { backgroundColor: swatch.hex } : undefined}
            >
              {swatch.hex ? (
                checked ? (
                  <Check size={14} className="text-white drop-shadow" aria-hidden="true" />
                ) : null
              ) : (
                <Ban size={14} className="text-ink-faint" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
