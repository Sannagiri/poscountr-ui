import { useEffect, useRef, useState } from 'react';

import { Loader } from '@/components';
import { describeApiError } from '@/utils/errors';

import { buildThermalBillPdf } from '@/modules/billing/utils/thermalBillPdf';

import type { ThermalLayoutConfig } from '../../pdf/blockRenderers/types';
import { buildSampleThermalBillInput } from '../../utils/sampleThermalData';

export interface ThermalLayoutPreviewPaneProps {
  config: ThermalLayoutConfig;
}

const PREVIEW_DEBOUNCE_MS = 400;

/** Settles on `value` only after it's stayed unchanged for `delayMs` — same debounce `LayoutPreviewPane.tsx` uses for the A4 builder's own live preview. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * One paper-width column of the Thermal Bill preview — its own fetch/blob-
 * URL lifecycle so a slow 80mm render never blocks the 58mm one (or vice
 * versa) from updating.
 */
function ThermalWidthPreview({
  paperWidth,
  config,
}: {
  paperWidth: '58mm' | '80mm';
  config: ThermalLayoutConfig;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErrorMessage(null);

    buildThermalBillPdf(buildSampleThermalBillInput(paperWidth, config))
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
        previousUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(describeApiError(error));
      });

    return () => {
      cancelled = true;
    };
  }, [paperWidth, config]);

  useEffect(() => {
    return () => {
      if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {paperWidth}
      </p>
      <div className="relative h-[70vh] overflow-auto rounded-control border border-border bg-surface/40">
        {errorMessage ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-danger">
            {errorMessage}
          </div>
        ) : blobUrl ? (
          <iframe
            title={`Thermal preview (${paperWidth})`}
            src={blobUrl}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader label="Rendering preview…" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Live preview of the in-progress Thermal Bill `config` — side by side at
 * both 58mm and 80mm, since one design is shared across whichever width a
 * business's `InvoiceSettings.paperWidth` actually picks (there's no
 * per-width layout to switch between, so both render at once rather than
 * behind a tab/toggle). Uses the real `buildThermalBillPdf` renderer
 * (unlike the A4 `LayoutPreviewPane`'s self-contained `buildDocumentPdf`)
 * against fixture data (`sampleThermalData.ts`) rather than a real order.
 */
export function ThermalLayoutPreviewPane({ config }: ThermalLayoutPreviewPaneProps) {
  const debouncedConfig = useDebouncedValue(config, PREVIEW_DEBOUNCE_MS);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ThermalWidthPreview paperWidth="58mm" config={debouncedConfig} />
      <ThermalWidthPreview paperWidth="80mm" config={debouncedConfig} />
    </div>
  );
}
