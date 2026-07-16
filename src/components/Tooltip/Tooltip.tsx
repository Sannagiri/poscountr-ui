import type { ReactNode } from 'react';

import * as RadixTooltip from '@radix-ui/react-tooltip';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Small hover/focus hint bubble — used for the odd "what does this mean"
 * info icon next to a label, never for content the person needs in order to
 * use the screen (that belongs in a `hint` under the field, not a tooltip).
 * Built on `@radix-ui/react-tooltip` for positioning/focus behavior; the
 * bubble itself is our own styling (docs/coding-standards.md §18).
 */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-[220px] rounded-control bg-ink px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-dropdown"
          >
            {content}
            <RadixTooltip.Arrow className="fill-ink" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
