import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye } from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  Input,
  Loader,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '@/components';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';
import { breakpoints } from '@/styles/breakpoints';

import { useBusinesses } from '@/modules/businesses';

import { DocumentTypesSelect } from '../components/DocumentTypesSelect';
import { LayoutConfigPanel } from '../components/LayoutConfigPanel';
import type { LayoutDragData, LayoutDropData } from '../components/LayoutGrid';
import { BlockPalette, LayoutGrid } from '../components/LayoutGrid';
import { LayoutPreviewPane } from '../components/LayoutPreviewPane';
import { SYSTEM_DEFAULT_LAYOUT_CONFIG } from '../constants/documentLayouts.constants';
import { useLayoutTemplate } from '../hooks/useLayoutTemplate';
import { useLayoutTemplateMutations } from '../hooks/useLayoutTemplateMutations';
import type { A4DocType } from '../pdf/blockRenderers/types';
import type { LayoutConfig, SlotKey } from '../types/documentLayouts.types';

import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

const GLOBAL_SCOPE_VALUE = 'global';

/** Deep clone — every edit in the grid/config panel mutates local state, never `SYSTEM_DEFAULT_LAYOUT_CONFIG` itself (a shared module-level constant every "new layout" starts from). */
function cloneConfig(config: LayoutConfig): LayoutConfig {
  return JSON.parse(JSON.stringify(config)) as LayoutConfig;
}

/**
 * Create (`id === 'new'`) or edit (a real id) a layout template — one page
 * for both, since unlike e.g. `NewPurchaseOrderPage`/`PurchaseOrderDetailPage`
 * (genuinely different UIs: a line-picking flow vs. a read-mostly detail
 * view), a layout's create and edit forms are the exact same fields + the
 * exact same drag-and-drop canvas, just a different submit request (POST vs.
 * PATCH) — splitting them would just duplicate this whole page.
 *
 * Explicit "Save" button, not autosave — unlike `InvoiceSettingsPage`'s
 * debounced-autosave (a stable, mostly-independent set of fields where
 * saving mid-keystroke is harmless), a half-dragged canvas mid-edit
 * shouldn't hit the network on every intermediate drop.
 *
 * Two columns (left: searchable palette + table style + font size +
 * selected-slot properties; middle: the canvas) — the preview is ALWAYS
 * behind the "Preview" button + `Modal`, never an inline third column. An
 * always-visible live pane made the canvas feel cramped/compacted at every
 * screen size, not just small ones — a `Modal` gives the preview its own
 * full-width breathing room on demand instead. `DndContext` lives here (not
 * inside `LayoutGrid`) since the palette (left column) and the canvas's
 * `SlotCell`s (middle column) need to share one drag context despite being
 * visually separate columns.
 */
export function LayoutEditorPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const id = params.id ?? 'new';
  const isCreate = id === 'new';

  const isDesktopLayout = useMediaQuery(`(min-width: ${breakpoints.xl}px)`);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const businessesQuery = useBusinesses();
  const templateQuery = useLayoutTemplate(isCreate ? undefined : id);
  const { createLayoutTemplate, updateLayoutTemplate } = useLayoutTemplateMutations();

  const [name, setName] = useState('');
  const [businessScope, setBusinessScope] = useState<string>(GLOBAL_SCOPE_VALUE);
  const [documentTypes, setDocumentTypes] = useState<A4DocType[]>([]);
  const [config, setConfig] = useState<LayoutConfig>(() =>
    cloneConfig(SYSTEM_DEFAULT_LAYOUT_CONFIG),
  );
  const [selectedSlot, setSelectedSlot] = useState<SlotKey | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Seeds local state exactly once per `id` — either a fresh "new layout"
  // starting point, or the fetched template's own values. Re-running only
  // when `id` (or the just-fetched data's own `id`) changes means a
  // background refetch (e.g. after another tab's edit) never clobbers
  // whatever the user is mid-way through editing here.
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  useEffect(() => {
    if (isCreate) {
      if (initializedFor !== 'new') {
        setName('');
        setBusinessScope(GLOBAL_SCOPE_VALUE);
        setDocumentTypes([]);
        setConfig(cloneConfig(SYSTEM_DEFAULT_LAYOUT_CONFIG));
        setSelectedSlot(null);
        setInitializedFor('new');
      }
      return;
    }
    if (templateQuery.data && initializedFor !== templateQuery.data.id) {
      setName(templateQuery.data.name);
      setBusinessScope(templateQuery.data.businessId ?? GLOBAL_SCOPE_VALUE);
      // This page only ever routes to an A4 template (a Thermal Bill one
      // has its own separate editor page/route) — safe to narrow both the
      // wire-generic `DocType`/`AnyLayoutConfig` down to this page's own
      // A4-only state types.
      setDocumentTypes(templateQuery.data.documentTypes as A4DocType[]);
      setConfig(templateQuery.data.config as LayoutConfig);
      setSelectedSlot(null);
      setInitializedFor(templateQuery.data.id);
    }
  }, [isCreate, templateQuery.data, initializedFor]);

  const selectedBusinessId = businessScope === GLOBAL_SCOPE_VALUE ? null : businessScope;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const dropData = over.data.current as LayoutDropData | undefined;
    const targetSlotKey = dropData?.slotKey;
    if (!targetSlotKey) return;

    const dragData = active.data.current as LayoutDragData | undefined;
    if (!dragData) return;

    const slots = config.slots;
    const next = { ...slots };
    if (dragData.source === 'palette') {
      next[targetSlotKey] = { block: dragData.blockType };
    } else {
      const sourceSlotKey = dragData.slotKey;
      if (sourceSlotKey === targetSlotKey) return;
      const sourceValue = slots[sourceSlotKey] ?? { block: 'empty' };
      const targetValue = slots[targetSlotKey] ?? { block: 'empty' };
      next[sourceSlotKey] = targetValue;
      next[targetSlotKey] = sourceValue;
    }
    setConfig({ ...config, slots: next });
  }

  function clearSlot(slotKey: SlotKey) {
    setConfig({ ...config, slots: { ...config.slots, [slotKey]: { block: 'empty' } } });
  }

  function handleSave() {
    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (documentTypes.length === 0) {
      setFormError('Select at least one document type.');
      return;
    }
    setFormError(null);

    if (isCreate) {
      createLayoutTemplate.mutate(
        { name: name.trim(), businessId: selectedBusinessId, documentTypes, config },
        {
          onSuccess: (created) => {
            showToast({ tone: 'success', message: 'Layout created.' });
            navigate(`/layouts/${created.id}`, { replace: true });
          },
          onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
        },
      );
    } else {
      updateLayoutTemplate.mutate(
        { id, data: { name: name.trim(), documentTypes, config } },
        {
          onSuccess: () => showToast({ tone: 'success', message: 'Layout saved.' }),
          onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
        },
      );
    }
  }

  const isSaving = createLayoutTemplate.isPending || updateLayoutTemplate.isPending;
  const businessOptions = [
    { value: GLOBAL_SCOPE_VALUE, label: 'Global (any business)' },
    ...(businessesQuery.data ?? []).map((business) => ({
      value: business.id,
      label: business.name,
    })),
  ];

  if (!isCreate && templateQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Layout" />
        <Card>
          <Loader label="Loading layout…" />
        </Card>
      </div>
    );
  }

  if (!isCreate && templateQuery.isError) {
    return (
      <div>
        <PageHeader title="Layout" />
        <Card>
          <p className="text-sm text-danger">{describeApiError(templateQuery.error)}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isCreate ? 'New layout' : name || 'Layout'}
        subtitle="Drag blocks into the 7 fixed slots, configure the logo/business details zones, author the notes zones, style the item table, and preview the result live"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<Eye size={16} />}
              onClick={() => setPreviewModalOpen(true)}
              disabled={documentTypes.length === 0}
            >
              Preview
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              Save
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardHeader
          title="Details"
          subtitle="Name, scope, and which documents this layout can be used for"
        />
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Name"
              placeholder="e.g. Blue formal invoice"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Select
              label="Scope"
              value={businessScope}
              onChange={setBusinessScope}
              options={businessOptions}
              disabled={!isCreate}
              hint={!isCreate ? "Scope can't be changed after creation." : undefined}
            />
            <DocumentTypesSelect
              label="Document types"
              value={documentTypes}
              onChange={setDocumentTypes}
            />
          </div>
          {formError ? <p className="text-xs text-danger">{formError}</p> : null}
        </div>
      </Card>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={cn('grid grid-cols-1 gap-4', isDesktopLayout && 'grid-cols-12')}>
          <div className={cn('flex flex-col gap-3.5', isDesktopLayout && 'col-span-4')}>
            <Card>
              <CardHeader title="Blocks" subtitle="Drag onto a slot in the canvas" />
              <BlockPalette />
            </Card>
            <LayoutConfigPanel
              config={config}
              onConfigChange={setConfig}
              selectedSlot={selectedSlot}
            />
          </div>

          <div className={cn(isDesktopLayout && 'col-span-8')}>
            <LayoutGrid
              config={config}
              onConfigChange={setConfig}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onClearSlot={clearSlot}
            />
          </div>
        </div>
      </DndContext>

      <Modal open={previewModalOpen} onOpenChange={setPreviewModalOpen} title="Preview" size="xl">
        <LayoutPreviewPane config={config} documentTypes={documentTypes} />
      </Modal>
    </div>
  );
}
