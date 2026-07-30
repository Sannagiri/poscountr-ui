import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/Button';
import { cn } from '@/utils/cn';

/** Mirrors the backend's own way-bill attach endpoint limits (both the purchasing module's own control and billing's, on the existing sales `Order`) — client-side for instant feedback, not a replacement for the server's own check. */
const MAX_WAY_BILL_BYTES = 10 * 1024 * 1024;
const ACCEPTED_WAY_BILL_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export interface WayBillUploadProps {
  /** Defaults to "Way-bill" — override for context (rare; every current caller leaves this alone). */
  label?: string;
  /** The current file's URL, or `null` when nothing's uploaded yet. */
  url: string | null;
  uploadedAt: string | null;
  onUpload: (file: File) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  /** e.g. while the parent order/purchase order itself is still loading — disables every control here too. */
  disabled?: boolean;
}

/**
 * Upload / replace / remove control for a "way-bill" attachment (an e-way
 * bill — a PDF, or a phone photo of the physical copy) — one small
 * reusable component shared by `OrderDetailPage` (the existing sales
 * `Order`) and `PurchaseOrderDetailPage` (the new purchasing module), since
 * both attach to the exact same shape of endpoint (`POST .../way-bill/`
 * multipart field `way_bill`, `DELETE .../way-bill/`) with the same file
 * limits. Lives in the shared component library, not either feature module,
 * since it has no domain logic of its own — the caller supplies the
 * upload/remove calls and the current url/timestamp.
 *
 * Mirrors `ProductImageField`'s "upload immediately against an existing
 * resource" shape, but as a document link + filename-less row (not an image
 * thumbnail) since a way-bill can be a PDF as easily as a photo.
 */
export function WayBillUpload({
  label = 'Way-bill',
  url,
  uploadedAt,
  onUpload,
  onRemove,
  disabled = false,
}: WayBillUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const isBusy = disabled || isUploading || isRemoving;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setClientError(null);
    if (file.size > MAX_WAY_BILL_BYTES) {
      setClientError('That file is over 10MB — pick a smaller one.');
      return;
    }
    if (!ACCEPTED_WAY_BILL_TYPES.includes(file.type)) {
      setClientError('Only a PDF or a JPEG/PNG/WebP photo is accepted.');
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch {
      // The parent's own mutation surfaces the real error (toast) — this
      // just resets the busy state so the control isn't stuck spinning.
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await onRemove();
    } catch {
      // Same as above — the parent's own mutation owns error reporting.
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      {url ? (
        <div className="flex items-center justify-between gap-3 rounded-control border border-border p-3">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2 text-sm font-medium text-brand hover:underline"
          >
            <FileText size={16} className="shrink-0" />
            <span className="truncate">View way-bill</span>
          </a>
          <div className="flex shrink-0 items-center gap-1.5">
            {uploadedAt ? (
              <span className="text-xs text-ink-faint">
                {new Date(uploadedAt).toLocaleDateString()}
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isUploading}
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <button
              type="button"
              aria-label="Remove way-bill"
              disabled={isBusy}
              onClick={handleRemove}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-control text-ink-faint transition-colors',
                'hover:border-danger hover:bg-danger-bg hover:text-danger disabled:opacity-50',
              )}
            >
              {isRemoving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          leadingIcon={<Upload size={14} />}
          isLoading={isUploading}
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          Upload way-bill
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {clientError ? <p className="text-xs text-danger">{clientError}</p> : null}
    </div>
  );
}
