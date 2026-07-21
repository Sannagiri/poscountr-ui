import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/utils/cn';

import * as Dialog from '@radix-ui/react-dialog';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  /**
   * Skips the bordered title/description header bar and its close button —
   * for dialogs that present their own centered content instead (see
   * `ConfirmDialog`, the one modal that isn't built header+body+footer).
   * `title` (and `description`, if given) are still rendered for screen
   * readers via Radix's required `Dialog.Title`, just visually hidden.
   */
  hideHeader?: boolean;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Base modal, built on Radix Dialog for focus-trapping and keyboard/escape
 * handling out of the box (docs/coding-standards.md §18). Every dialog in
 * the app composes this instead of a bespoke overlay, and always as three
 * visually distinct sections — a bordered header (title + close), a
 * scrollable body, and a bordered/shaded footer for actions — so the same
 * chrome reads consistently everywhere a modal is used. `ConfirmDialog` is
 * the deliberate exception (`hideHeader`): it centers a status icon + text
 * instead of a title bar, and keeps only the footer.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  footer,
  children,
  hideHeader = false,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-hidden rounded-card border border-border bg-white shadow-dropdown focus:outline-none',
            SIZE_CLASSES[size],
          )}
        >
          {hideHeader ? (
            <>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="sr-only">{description}</Dialog.Description>
              ) : null}
            </>
          ) : (
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
          )}
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5', hideHeader ? 'py-5' : 'py-4')}>
            {children}
          </div>
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
