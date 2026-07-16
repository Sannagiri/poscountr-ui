import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { useToast } from '@/components/Toast';
import { cn } from '@/utils/cn';

export interface CopyableTextProps {
  /** The exact string written to the clipboard — the visible text can differ (e.g. truncated/formatted). */
  value: string;
  /** What's rendered. Defaults to `value` itself. */
  children?: ReactNode;
  /** Toast message on a successful copy. Default: "Copied to clipboard". */
  copiedMessage?: string;
  className?: string;
}

/**
 * Wraps a short piece of text (an email address, most often) so clicking it
 * copies the value to the clipboard and confirms with a toast — used
 * anywhere an email is displayed as plain text (`TenantCard`,
 * `TenantAdminsModal`, `PlatformAdminsPage`'s email column) instead of it
 * just sitting there with no way to grab it short of a manual text
 * selection. Doesn't change the surrounding typography — callers keep their
 * own truncate/size classes via `className`; this only adds the click
 * affordance and a small copy icon that appears on hover/focus.
 */
export function CopyableText({ value, children, copiedMessage, className }: CopyableTextProps) {
  const { showToast } = useToast();
  const [justCopied, setJustCopied] = useState(false);

  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setJustCopied(true);
      showToast({ tone: 'success', message: copiedMessage ?? 'Copied to clipboard' });
      window.setTimeout(() => setJustCopied(false), 1200);
    } catch {
      showToast({ tone: 'danger', message: 'Could not copy — try selecting the text instead' });
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${value}`}
      className={cn(
        'group inline-flex max-w-full items-center gap-1 rounded text-left hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        className,
      )}
    >
      <span className="min-w-0 truncate">{children ?? value}</span>
      {justCopied ? (
        <Check size={12} className="shrink-0 text-success" />
      ) : (
        <Copy size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
