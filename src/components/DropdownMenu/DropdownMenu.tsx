import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/utils/cn';

import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';

export interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** Renders in `danger` colors — for a "Remove"/"Deactivate" style action. */
  destructive?: boolean;
  disabled?: boolean;
}

/** A `-` renders a separator line instead of an item. */
export type DropdownMenuEntry = DropdownMenuItem | '-';

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuEntry[];
  align?: 'start' | 'end' | 'center';
}

/**
 * Generic action-list dropdown — the one popover every "⋮" button or user
 * menu in the app opens, instead of each screen hand-rolling its own
 * `@radix-ui/react-dropdown-menu` markup (docs/coding-standards.md §6).
 * Radix supplies keyboard nav/focus/positioning; every visual piece is this
 * component's own styling, matching `Select`/`Tooltip`/`Tabs`. Items are data
 * (`DropdownMenuItem[]`), not children, so both `DataTable`'s per-row action
 * menu and `Topbar`'s user menu share one implementation and one look.
 */
export function DropdownMenu({ trigger, items, align = 'end' }: DropdownMenuProps) {
  return (
    <RadixDropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>{trigger}</RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 w-48 rounded-control border border-border bg-white p-1 shadow-dropdown"
        >
          {items.map((entry, index) => {
            if (entry === '-') {
              return (
                <RadixDropdownMenu.Separator
                  key={`separator-${index}`}
                  className="my-1 h-px bg-border"
                />
              );
            }
            const Icon = entry.icon;
            return (
              <RadixDropdownMenu.Item
                key={entry.label}
                disabled={entry.disabled}
                onSelect={entry.onSelect}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-2 text-xs font-medium outline-none',
                  entry.destructive
                    ? 'text-danger hover:bg-danger-bg'
                    : 'text-ink hover:bg-surface',
                  'data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-faint data-[disabled]:hover:bg-transparent',
                )}
              >
                {Icon ? <Icon size={14} className="shrink-0" /> : null}
                {entry.label}
              </RadixDropdownMenu.Item>
            );
          })}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}
