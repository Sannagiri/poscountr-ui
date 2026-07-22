import type { DragEvent } from 'react';
import { useRef, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';

import { Badge, Button, ErrorMessage, Modal } from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';

import type { EntityType } from '@/modules/businesses';
import { EntityTypePicker } from '@/modules/businesses';

import { INVENTORY_QUERY_KEYS } from '../../constants/inventory.constants';
import { inventoryService } from '../../services/inventoryService';
import type { ImportReport } from '../../types/inventory.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type View = 'upload' | 'report';

export interface ImportProductsModalProps {
  open: boolean;
  /** Which business the imported rows belong to — same scoping as a manual create (omitted lets the backend resolve a manager's own business, or a tenant_admin's sole business). */
  businessId?: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Template download + upload + per-row report, per the confirm-first
 * choice for this phase: a `Modal` with a summary strip and a scrollable
 * error table, since the report shape (`{created, updated, errors:
 * [{row, message}], targetLocation}`) is flat and small enough not to need
 * anything fancier. Always resolves with a report even when every row
 * failed — see `inventoryService.importProducts`'s own doc comment — so
 * "the import call succeeded" and "every row succeeded" are deliberately
 * shown as two different things here (a summary strip either way, an error
 * table only when `errors.length > 0`).
 *
 * The two "1. Get a template" / "2. Upload" panels are plain bordered
 * boxes (no fill) rather than `bg-surface` — a tinted panel here read as an
 * unintentional "info box" against the modal's white background. Step 2 is
 * a drag-and-drop zone (falls back to click-to-browse) rather than a plain
 * button, since dropping a file straight from Finder/Explorer is the
 * faster path for the `.xlsx` this step always wants.
 *
 * Step 1's business type uses the same `EntityTypePicker` icon grid as the
 * business create/edit forms, not a plain text `Select` — this panel is
 * short, and a floating select popover opening below the trigger had
 * nowhere to go but over the "2. Upload" panel underneath it, which read as
 * a layout bug rather than a dropdown. The icon grid lays out inline, so
 * there's nothing to float over anything.
 */
export function ImportProductsModal({ open, businessId, onOpenChange }: ImportProductsModalProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>('upload');
  const [entityType, setEntityType] = useState<EntityType>('retail');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView('upload');
      setFile(null);
      setIsDragging(false);
      setUploadError(null);
      setReport(null);
    }
  }

  const templateMutation = useMutation({
    mutationFn: () => inventoryService.downloadImportTemplate(entityType),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `poscountr-products-${entityType}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error) => setUploadError(describeApiError(error)),
  });

  const importMutation = useMutation({
    mutationFn: () => inventoryService.importProducts(file as File, businessId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.categories });
      setReport(result);
      setView('report');
    },
    onError: (error) => setUploadError(describeApiError(error)),
  });

  /** Shared by the file input's onChange and the dropzone's onDrop — the browse dialog already restricts to `.xlsx` via `accept`, but a drag-and-drop can carry anything, so this re-checks the extension either way. */
  function selectFile(selected: File | null | undefined) {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setUploadError('Only .xlsx files are accepted.');
      return;
    }
    setUploadError(null);
    setFile(selected);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Import products"
      description={
        view === 'upload'
          ? 'Download a template for your business type, fill it in, then upload it back'
          : undefined
      }
      size="lg"
      footer={
        view === 'upload' ? (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!file}
              isLoading={importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              Import
            </Button>
          </>
        ) : (
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        )
      }
    >
      {view === 'upload' ? (
        <div className="flex flex-col gap-4">
          {uploadError ? <ErrorMessage message={uploadError} /> : null}

          <div className="flex flex-col gap-3 rounded-control border border-border p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                1
              </span>
              <span className="text-sm font-semibold text-ink">Get a template</span>
            </div>
            <EntityTypePicker
              label="Business type"
              value={entityType}
              onChange={(value) => setEntityType(value as EntityType)}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-faint">
                Picks which columns the template has — e.g. batch/expiry for pharmacy
              </p>
              <Button
                type="button"
                variant="outline"
                leadingIcon={<Download size={14} />}
                isLoading={templateMutation.isPending}
                onClick={() => templateMutation.mutate()}
                className="self-start sm:shrink-0"
              >
                Template
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-control border border-border p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                2
              </span>
              <span className="text-sm font-semibold text-ink">Upload the filled-in file</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-control border-2 border-dashed p-6 text-center transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                isDragging ? 'border-brand bg-brand/5' : 'border-border hover:border-border-strong',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isDragging
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-white text-ink-faint',
                )}
              >
                <FileSpreadsheet size={18} />
              </span>
              {file ? (
                <>
                  <span className="text-sm font-medium text-ink">{file.name}</span>
                  <span className="text-xs text-ink-faint">
                    Drop another file, or click to replace it
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-ink">
                    Drag and drop your .xlsx file here
                  </span>
                  <span className="text-xs text-ink-faint">or click to browse</span>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => {
                selectFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <p className="text-xs text-ink-faint">
              Existing SKUs are updated in place; new SKUs are created. A row&apos;s own problem (a
              bad price, a missing name) is skipped and reported — it doesn&apos;t stop the rest of
              the file from importing.
            </p>
          </div>
        </div>
      ) : report ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{report.createdCount} created</Badge>
            <Badge tone="accent">{report.updatedCount} updated</Badge>
            <Badge tone={report.errors.length > 0 ? 'danger' : 'neutral'}>
              {report.errors.length} errors
            </Badge>
            {report.targetLocation ? (
              <span className="text-xs text-ink-faint">
                Stock/batches applied to: {report.targetLocation}
              </span>
            ) : (
              <span className="text-xs text-ink-faint">
                No active location — opening stock/batch rows were skipped
              </span>
            )}
          </div>

          {report.errors.length > 0 ? (
            <div className="max-h-72 overflow-y-auto rounded-control border border-border">
              <div className="grid grid-cols-[80px_1fr] border-b border-border bg-surface">
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Row</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Problem</div>
              </div>
              {report.errors.map((rowError, index) => (
                <div
                  key={`${rowError.row}-${index}`}
                  className="grid grid-cols-[80px_1fr] border-b border-border last:border-none"
                >
                  <div className="px-3 py-2.5 text-sm font-medium text-ink">{rowError.row}</div>
                  <div className="px-3 py-2.5 text-sm text-ink-soft">{rowError.message}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
