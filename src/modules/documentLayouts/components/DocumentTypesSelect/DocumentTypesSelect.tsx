import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/utils/cn';

import type { A4DocType } from '../../pdf/blockRenderers/types';

import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';

const DOC_TYPE_OPTIONS: { value: A4DocType; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'purchase_order', label: 'Purchase Order' },
];

export interface DocumentTypesSelectProps {
  label?: string;
  value: A4DocType[];
  onChange: (value: A4DocType[]) => void;
  errorMessage?: string;
}

/**
 * Which document types a layout applies to — a checkbox dropdown (not the
 * always-visible checkbox row `LayoutEditorPage.tsx` used to render inline)
 * so the "Details" card stays a fixed, predictable height regardless of how
 * many of the 3 fixed options are checked. Radix `DropdownMenu.CheckboxItem`
 * over `Select` (single-value only, per its own doc comment) or a bespoke
 * popover — each item's `onSelect` calls `preventDefault()` so picking one
 * doesn't close the menu, letting a business check more than one type in a
 * row without reopening.
 */
export function DocumentTypesSelect({
  label,
  value,
  onChange,
  errorMessage,
}: DocumentTypesSelectProps) {
  const hasError = Boolean(errorMessage);
  const summary =
    value.length === 0
      ? 'Select document types'
      : DOC_TYPE_OPTIONS.filter((option) => value.includes(option.value))
          .map((option) => option.label)
          .join(', ');

  function toggle(docType: A4DocType, checked: boolean) {
    onChange(checked ? [...value, docType] : value.filter((v) => v !== docType));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="text-xs font-semibold text-ink-soft">{label}</span> : null}
      <RadixDropdownMenu.Root>
        <RadixDropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-white px-3 text-sm text-ink transition-colors',
              'hover:border-border-strong',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              hasError ? 'border-danger' : 'border-border',
              value.length === 0 && 'text-ink-faint',
            )}
          >
            <span className="truncate">{summary}</span>
            <ChevronDown size={15} className="shrink-0 text-ink-faint" />
          </button>
        </RadixDropdownMenu.Trigger>

        <RadixDropdownMenu.Portal>
          <RadixDropdownMenu.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[12rem] rounded-control border border-border bg-white p-1 shadow-dropdown"
          >
            {DOC_TYPE_OPTIONS.map((option) => {
              const checked = value.includes(option.value);
              return (
                <RadixDropdownMenu.CheckboxItem
                  key={option.value}
                  checked={checked}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(next) => toggle(option.value, next)}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center gap-2 rounded-[6px] px-2.5 py-2 pr-7 text-sm text-ink outline-none',
                    'data-[highlighted]:bg-surface',
                  )}
                >
                  {option.label}
                  {checked ? (
                    <span className="absolute right-2.5 inline-flex items-center text-brand">
                      <Check size={14} />
                    </span>
                  ) : null}
                </RadixDropdownMenu.CheckboxItem>
              );
            })}
          </RadixDropdownMenu.Content>
        </RadixDropdownMenu.Portal>
      </RadixDropdownMenu.Root>
      {hasError ? <p className="text-xs text-danger">{errorMessage}</p> : null}
    </div>
  );
}
