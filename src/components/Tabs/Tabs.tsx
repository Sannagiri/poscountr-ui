import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import * as RadixTabs from '@radix-ui/react-tabs';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

/**
 * Underlined tab strip, built on `@radix-ui/react-tabs` (a dependency since
 * F0, never wired up until Tenant detail needed an Overview/Admins split —
 * same pattern as `Select`/`Tooltip`: Radix supplies keyboard nav and
 * panel-switching only, every visual piece is this component's own markup.
 * Uncontrolled (`defaultValue`) or controlled (`value`/`onValueChange`),
 * whichever a screen needs.
 */
export function Tabs({ items, defaultValue, value, onValueChange }: TabsProps) {
  return (
    <RadixTabs.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
    >
      <RadixTabs.List className="mb-4 flex gap-1 border-b border-border">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'rounded-t-[6px] border-b-2 border-transparent px-3.5 py-2.5 text-sm font-semibold text-ink-faint transition-colors',
              'hover:text-ink-soft',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40',
              'data-[state=active]:border-brand data-[state=active]:text-ink',
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value}>
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
