import { useEffect, useState } from 'react';
import { ScanBarcode } from 'lucide-react';

import { Badge, Button, EmptyState, Modal } from '@/components';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { describeApiError } from '@/utils/errors';

import { formatQuantity, isStockRowLow } from '../../constants/inventory.constants';
import { inventoryService } from '../../services/inventoryService';
import type { Product } from '../../types/inventory.types';
import { ProductThumbnail } from '../ProductThumbnail';

export interface ProductLookupModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The general "scan anywhere to see full product details" surface —
 * distinct from the Order pages' scan-to-cart: this only ever looks a
 * product up and shows it, never adds anything anywhere. Armed only while
 * open (`enabled: open`), not ambiently on the whole `ProductsPage`, so it
 * stays a predictable, opt-in scan target that can't interfere with that
 * page's own search/filter inputs.
 */
export function ProductLookupModal({ open, onClose }: ProductLookupModalProps) {
  const [result, setResult] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setErrorMessage(null);
    }
  }, [open]);

  useBarcodeScanner({
    enabled: open,
    onScan: async (code) => {
      try {
        const product = await inventoryService.lookupProductByCode(code);
        setResult(product);
        setErrorMessage(null);
      } catch (error) {
        setResult(null);
        setErrorMessage(describeApiError(error));
      }
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Scan barcode"
      description="Look up a product's details without adding it anywhere"
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <ProductThumbnail imageUrl={result.imageUrl} name={result.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{result.name}</p>
              <p className="text-sm text-ink-soft">
                SKU {result.sku}
                {result.barcode ? ` · Barcode ${result.barcode}` : ''}
              </p>
              <p className="text-sm text-ink-soft">{result.category || 'No category'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-control border border-border p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-ink-faint">Selling price</p>
              <p className="font-semibold text-ink">₹{result.sellingPrice}</p>
            </div>
            {result.mrp ? (
              <div>
                <p className="text-ink-faint">MRP</p>
                <p className="font-semibold text-ink">₹{result.mrp}</p>
              </div>
            ) : null}
            <div>
              <p className="text-ink-faint">Status</p>
              <Badge tone={result.isActive ? 'success' : 'neutral'}>
                {result.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {result.isStockTracked ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Stock by location</p>
              {result.stock.length === 0 ? (
                <p className="text-sm text-ink-soft">No stock recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {result.stock.map((row) => (
                    <div
                      key={row.locationId}
                      className="flex items-center justify-between rounded-control border border-border px-3 py-1.5 text-sm"
                    >
                      <span className="text-ink">{row.locationName}</span>
                      <span className={isStockRowLow(row) ? 'text-danger' : 'text-ink-soft'}>
                        {formatQuantity(row.quantity, result.unit)} {result.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : errorMessage ? (
        <EmptyState
          icon={<ScanBarcode size={20} />}
          title="No matching product"
          description={errorMessage}
        />
      ) : (
        <EmptyState
          icon={<ScanBarcode size={20} />}
          title="Waiting for scan…"
          description="Scan a product's barcode with a connected scanner."
        />
      )}
    </Modal>
  );
}
