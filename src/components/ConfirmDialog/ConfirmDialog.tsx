import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { cn } from '@/utils/cn';

export type ConfirmDialogVariant = 'success' | 'warning' | 'danger';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  isDestructive?: boolean;
  /**
   * Which status icon to center above the text. Defaults from
   * `isDestructive` (`danger` when true, `success` otherwise) so existing
   * call sites don't need to change, but can be set explicitly — e.g. a
   * "suspend" confirm reads better as `warning` than `danger`.
   */
  variant?: ConfirmDialogVariant;
  /**
   * Drops the Cancel button, leaving a single action — for a pure
   * acknowledgment (e.g. a post-success "Great, thanks!") rather than a
   * yes/no decision. `onCancel` is still called when the dialog is
   * dismissed via the overlay or Escape, so callers only need one handler.
   */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_ICONS: Record<ConfirmDialogVariant, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const VARIANT_CLASSES: Record<ConfirmDialogVariant, string> = {
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
};

/**
 * Standard confirmation dialog (delete, deactivate, cancel-order, …) — the
 * one modal in the app that doesn't use the header+body+footer chrome
 * (`docs/coding-standards.md` shell convention). Instead of a title bar it
 * centers a status icon (success/warning/danger) with a heading and
 * description, and keeps only the footer for the two actions. Every
 * destructive or irreversible action in the app must be gated by one of
 * these instead of firing immediately (docs/coding-standards.md §7).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  isDestructive = true,
  variant,
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const resolvedVariant = variant ?? (isDestructive ? 'danger' : 'success');
  const Icon = VARIANT_ICONS[resolvedVariant];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      description={description}
      hideHeader
      size="sm"
      footer={
        <>
          {hideCancel ? null : (
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              {cancelText}
            </Button>
          )}
          <Button
            variant={isDestructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full',
            VARIANT_CLASSES[resolvedVariant],
          )}
        >
          <Icon size={24} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-display text-base font-bold text-ink">{title}</p>
          {description ? <p className="text-xs text-ink-soft">{description}</p> : null}
        </div>
      </div>
    </Modal>
  );
}
