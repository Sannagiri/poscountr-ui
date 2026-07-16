import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { cn } from '@/utils/cn';

import type { ToastRecord, ToastTone } from './Toast.types';

const TONE_ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  danger: XCircle,
  warning: AlertTriangle,
  accent: Info,
};

const TONE_CHIP_CLASSES: Record<ToastTone, string> = {
  success: 'bg-success-bg text-success-text',
  danger: 'bg-danger-bg text-danger-text',
  warning: 'bg-warning-bg text-warning-text',
  accent: 'bg-accent/10 text-accent-dark',
};

const TONE_PROGRESS_CLASSES: Record<ToastTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  accent: 'bg-accent',
};

interface ToastItemProps {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}

/**
 * One stacked toast — icon chip (tone), message, close button, and a
 * decaying progress bar along the bottom edge that visually counts down the
 * auto-dismiss timer (Metronic's toast convention, restyled with this app's
 * own tone tokens instead of scraping the reference markup).
 *
 * The progress bar shrinks via a CSS width transition rather than a
 * `setInterval` tick — started one frame after mount (so the browser paints
 * the full-width bar first, otherwise the transition has nothing to animate
 * from) and timed to match the same `duration` the auto-dismiss timeout
 * uses, so the bar reaching zero and the toast disappearing happen together.
 */
export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [shrink, setShrink] = useState(false);
  const Icon = TONE_ICON[toast.tone];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShrink(true));
    const dismissTimer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(dismissTimer);
    };
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card border border-border bg-white p-3 pr-2 shadow-dropdown">
      <span
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
          TONE_CHIP_CLASSES[toast.tone],
        )}
      >
        <Icon size={15} />
      </span>
      <p className="min-w-0 flex-1 pt-1 text-xs font-medium text-ink">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <X size={14} />
      </button>
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-0 left-0 h-0.5 ease-linear',
          TONE_PROGRESS_CLASSES[toast.tone],
        )}
        style={{
          width: shrink ? '0%' : '100%',
          transitionProperty: 'width',
          transitionDuration: `${toast.duration}ms`,
        }}
      />
    </div>
  );
}
