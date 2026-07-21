import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, X } from 'lucide-react';

import { useToast } from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';

import { INVENTORY_QUERY_KEYS } from '../../constants/inventory.constants';
import { inventoryService } from '../../services/inventoryService';
import type { Product } from '../../types/inventory.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ProductImageFieldProps {
  product: Product;
}

/**
 * Icon-only image control — no "Upload image"/"Replace image"/"Remove"
 * text buttons sitting next to the thumbnail (they ate the row this shares
 * with SKU). No image yet: the dashed square itself is the upload button.
 * An image already: a small edit badge (bottom-right) reopens the file
 * picker to replace it, a small × badge (top-right) removes it — the
 * thumbnail itself isn't clickable, only the two badges are, same as most
 * avatar-editor widgets. Still mirrors the backend's own ≤5MB JPEG/PNG/WebP
 * limits (`apps/storage/utils.py::validate_image_file`) client-side for
 * instant feedback, not to replace the server's own check.
 */
export function ProductImageField({ product }: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [clientError, setClientError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => inventoryService.uploadProductImage(product.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      showToast({ tone: 'success', message: 'Image uploaded.' });
    },
    onError: (error) => setClientError(describeApiError(error)),
  });

  const removeMutation = useMutation({
    mutationFn: () => inventoryService.removeProductImage(product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      showToast({ tone: 'success', message: 'Image removed.' });
    },
    onError: (error) => setClientError(describeApiError(error)),
  });

  const isBusy = uploadMutation.isPending || removeMutation.isPending;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setClientError(null);
    if (file.size > MAX_IMAGE_BYTES) {
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
      <div className="text-xs font-semibold text-ink-soft">Image</div>
      <div className="relative inline-flex h-16 w-16 shrink-0">
        {product.imageUrl ? (
          <>
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-16 w-16 rounded-control border border-border object-cover"
            />
            <button
              type="button"
              aria-label="Replace image"
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
              aria-label="Remove image"
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
            aria-label="Upload image"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-control border border-dashed border-border text-ink-faint transition-colors',
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
