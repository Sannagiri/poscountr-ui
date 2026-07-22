import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, X } from 'lucide-react';

import { useToast } from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';

import { SETTINGS_QUERY_KEYS } from '../../constants/settings.constants';
import { settingsService } from '../../services/settingsService';

import { useMutation, useQueryClient } from '@tanstack/react-query';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface InvoiceLogoFieldProps {
  businessId: string;
  logoUrl: string;
}

/**
 * Logo control for a business's invoice branding — same
 * dashed-box-becomes-upload-button / edit+remove badge pattern as
 * inventory's `ProductImageField`, just pointed at
 * `/tenant/businesses/{id}/invoice-settings/logo/` instead of a product's
 * image endpoint. Mirrors the backend's own ≤5MB JPEG/PNG/WebP limit
 * (`apps/storage/constants.py`'s `MAX_PRODUCT_IMAGE_SIZE_BYTES`, reused for
 * logos too) client-side for instant feedback, not to replace the server's
 * own check.
 *
 * Unlike `ProductImageField`'s square thumbnail, this preview is a wide
 * (2:1) box with `object-contain` rather than `object-cover` — invoice logos
 * are typically a wordmark/lockup (wider than tall), and `object-cover` in a
 * square box was cropping most of the logo off the sides instead of
 * showing it in full.
 */
export function InvoiceLogoField({ businessId, logoUrl }: InvoiceLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [clientError, setClientError] = useState<string | null>(null);

  function applyResult(data: Awaited<ReturnType<typeof settingsService.uploadInvoiceLogo>>) {
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.invoiceSettings(businessId), data);
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => settingsService.uploadInvoiceLogo(businessId, file),
    onSuccess: (data) => {
      applyResult(data);
      showToast({ tone: 'success', message: 'Logo uploaded.' });
    },
    onError: (error) => setClientError(describeApiError(error)),
  });

  const removeMutation = useMutation({
    mutationFn: () => settingsService.removeInvoiceLogo(businessId),
    onSuccess: (data) => {
      applyResult(data);
      showToast({ tone: 'success', message: 'Logo removed.' });
    },
    onError: (error) => setClientError(describeApiError(error)),
  });

  const isBusy = uploadMutation.isPending || removeMutation.isPending;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setClientError(null);
    if (file.size > MAX_LOGO_BYTES) {
      setClientError('That file is over 5MB — pick a smaller image.');
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setClientError('Only JPEG, PNG, or WebP images are accepted.');
      return;
    }
    uploadMutation.mutate(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-ink-soft">Invoice logo</div>
      <div className="relative inline-flex h-16 w-32 shrink-0">
        {logoUrl ? (
          <>
            <img
              src={logoUrl}
              alt="Invoice logo"
              className="h-16 w-32 rounded-control border border-border bg-white object-contain p-1.5"
            />
            <button
              type="button"
              aria-label="Replace logo"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-ink-soft shadow-sm transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
            >
              {uploadMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Pencil size={12} />
              )}
            </button>
            <button
              type="button"
              aria-label="Remove logo"
              disabled={isBusy}
              onClick={() => removeMutation.mutate()}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-ink-faint shadow-sm transition-colors hover:border-danger hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
            >
              {removeMutation.isPending ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <X size={11} />
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label="Upload logo"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex h-16 w-32 items-center justify-center rounded-control border border-dashed border-border text-ink-faint transition-colors',
              'hover:border-border-strong hover:text-ink-soft disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            )}
          >
            {uploadMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ImagePlus size={20} />
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {clientError ? <p className="text-xs text-danger">{clientError}</p> : null}
    </div>
  );
}
