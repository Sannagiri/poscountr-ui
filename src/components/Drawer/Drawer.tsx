import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/utils/cn';

import * as Dialog from '@radix-ui/react-dialog';

export type DrawerSize = 'sm' | 'md' | 'lg';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: DrawerSize;
  footer?: ReactNode;
  children: ReactNode;
}

const SIZE_CLASSES: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
};

/**
 * Slide-over panel — same header/body/footer chrome as `Modal` (bordered
 * title + close button, scrollable body, bordered/shaded footer), anchored
 * to the right edge and full height instead of centered, for editing/
 * viewing one record "without leaving the list context" (the pattern this
 * was built for: Tenant edit — see `TenantEditDrawer` — replaced a separate
 * detail page + tabs with this, opened directly from a row click). Built on
 * the same Radix Dialog primitive as `Modal`, just positioned differently;
 * use `Modal` for anything that isn't fundamentally "a record next to the
 * list it came from."
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  footer,
  children,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-[calc(100%-2rem)] flex-col',
            'border-l border-border bg-white shadow-dropdown focus:outline-none',
            'translate-x-0 transition-transform duration-200 ease-out',
            'data-[state=closed]:translate-x-full',
            SIZE_CLASSES[size],
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-base font-bold text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-xs text-ink-soft">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2.5 border-t border-border bg-surface px-5 py-4">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
