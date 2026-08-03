import { useEffect, useRef, useState } from 'react';
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
  Switch,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';

import { useBusinesses } from '@/modules/businesses';

import { ThermalLayoutPreviewPane } from '../components/ThermalLayoutPreviewPane';
import {
  FONT_SIZE_PT_MAX,
  FONT_SIZE_PT_MIN,
  SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG,
} from '../constants/documentLayouts.constants';
import { useLayoutTemplate } from '../hooks/useLayoutTemplate';
import { useLayoutTemplateMutations } from '../hooks/useLayoutTemplateMutations';
import type {
  ThermalBusinessDetailsZoneConfig,
  ThermalHeaderZoneConfig,
  ThermalLayoutConfig,
} from '../pdf/blockRenderers/types';

const GLOBAL_SCOPE_VALUE = 'global';

const LOGO_SIZE_OPTIONS: { value: ThermalHeaderZoneConfig['size']; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

/** `config.business_details.position` is a single 3-way choice, not two independent switches — a business explicitly asked not to be able to turn both "top" and "footer" on at once and see it printed twice. */
const BUSINESS_DETAILS_POSITION_OPTIONS: {
  value: ThermalBusinessDetailsZoneConfig['position'];
  label: string;
}[] = [
  { value: 'none', label: "Don't show" },
  { value: 'top', label: 'Top, above header notes' },
  { value: 'footer', label: 'Footer, below totals' },
];

/** Deep clone — every edit mutates local state, never `SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG` itself (a shared module-level constant every "new layout" starts from). */
function cloneConfig(config: ThermalLayoutConfig): ThermalLayoutConfig {
  return JSON.parse(JSON.stringify(config)) as ThermalLayoutConfig;
}

/** A `header_notes`/`footer_notes`-shaped zone's enable switch + auto-growing textarea — same shape/behavior as `LayoutGrid.tsx`'s own `NotesZoneRow` (A4 side), just not co-located with it since this page has no drag-drop canvas to share a file with. */
function NotesZoneField({
  title,
  hint,
  zone,
  onChange,
}: {
  title: string;
  hint: string;
  zone: ThermalLayoutConfig['header_notes'];
  onChange: (zone: ThermalLayoutConfig['header_notes']) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [zone.text]);

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={hint}
        action={
          <Switch
            size="sm"
            checked={zone.enabled}
            onCheckedChange={(checked) => onChange({ ...zone, enabled: checked })}
            label={`Show ${title.toLowerCase()}`}
          />
        }
      />
      <textarea
        ref={textareaRef}
        rows={2}
        value={zone.text}
        disabled={!zone.enabled}
        onChange={(event) => onChange({ ...zone, text: event.target.value })}
        placeholder={`${title} text…`}
        className="w-full resize-none overflow-hidden rounded-control border border-border bg-surface-card px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-surface/50 disabled:text-ink-faint"
      />
    </Card>
  );
}

/**
 * Create (`id === 'new'`) or edit (a real id) a Thermal Bill layout template
 * — the receipt-width sibling of `LayoutEditorPage.tsx` (A4), on its own
 * route/page rather than folded into that one: the two config shapes are
 * genuinely different (no slots/drag-drop canvas here, one Footer zone
 * instead of `footer_1..4`, no Business Details/Payment Details/Signature),
 * and `documentTypes` is always exactly `['thermal_bill']` — never a
 * multi-select the way the A4 editor's own Details card offers, since a
 * Thermal Bill config could never render an invoice/quotation/purchase
 * order and vice versa.
 *
 * Same design renders at both 58mm and 80mm at *render* time (the roll
 * width lives on the business's own `InvoiceSettings.paperWidth`, not on
 * the layout) — so the live preview shows both widths side by side rather
 * than switching between them.
 */
export function ThermalLayoutEditorPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const id = params.id ?? 'new';
  const isCreate = id === 'new';

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const businessesQuery = useBusinesses();
  const templateQuery = useLayoutTemplate(isCreate ? undefined : id);
  const { createLayoutTemplate, updateLayoutTemplate } = useLayoutTemplateMutations();

  const [name, setName] = useState('');
  const [businessScope, setBusinessScope] = useState<string>(GLOBAL_SCOPE_VALUE);
  const [config, setConfig] = useState<ThermalLayoutConfig>(() =>
    cloneConfig(SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  useEffect(() => {
    if (isCreate) {
      if (initializedFor !== 'new') {
        setName('');
        setBusinessScope(GLOBAL_SCOPE_VALUE);
        setConfig(cloneConfig(SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG));
        setInitializedFor('new');
      }
      return;
    }
    if (templateQuery.data && initializedFor !== templateQuery.data.id) {
      setName(templateQuery.data.name);
      setBusinessScope(templateQuery.data.businessId ?? GLOBAL_SCOPE_VALUE);
      // This page only ever routes to a Thermal Bill template (an A4 one
      // has its own separate editor page/route) — safe to narrow the
      // wire-generic `AnyLayoutConfig` down to this page's own state type.
      // Shallow-merged over the system default so a row saved before
      // `business_details` existed (or any future key added the same way)
      // still loads with a complete shape instead of throwing on render.
      setConfig({
        ...cloneConfig(SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG),
        ...(templateQuery.data.config as ThermalLayoutConfig),
      });
      setInitializedFor(templateQuery.data.id);
    }
  }, [isCreate, templateQuery.data, initializedFor]);

  const selectedBusinessId = businessScope === GLOBAL_SCOPE_VALUE ? null : businessScope;

  function handleSave() {
    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }
    setFormError(null);

    if (isCreate) {
      createLayoutTemplate.mutate(
        {
          name: name.trim(),
          businessId: selectedBusinessId,
          documentTypes: ['thermal_bill'],
          config,
        },
        {
          onSuccess: (created) => {
            showToast({ tone: 'success', message: 'Layout created.' });
            navigate(`/layouts/thermal/${created.id}`, { replace: true });
          },
          onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
        },
      );
    } else {
      updateLayoutTemplate.mutate(
        { id, data: { name: name.trim(), documentTypes: ['thermal_bill'], config } },
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

  function handleFontSizeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const parsed = Number(event.target.value);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(FONT_SIZE_PT_MAX, Math.max(FONT_SIZE_PT_MIN, parsed));
    setConfig({ ...config, font_size_pt: clamped });
  }

  if (!isCreate && templateQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Thermal Bill Layout" />
        <Card>
          <Loader label="Loading layout…" />
        </Card>
      </div>
    );
  }

  if (!isCreate && templateQuery.isError) {
    return (
      <div>
        <PageHeader title="Thermal Bill Layout" />
        <Card>
          <p className="text-sm text-danger">{describeApiError(templateQuery.error)}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isCreate ? 'New thermal layout' : name || 'Thermal Bill Layout'}
        subtitle="Design the 58mm/80mm receipt — logo, header notes, and footer text; the item table + totals stay fixed"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<Eye size={16} />}
              onClick={() => setPreviewModalOpen(true)}
            >
              Preview
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              Save
            </Button>
          </div>
        }
      />

      {/* Two columns, same left/right split `LayoutEditorPage.tsx` (A4) uses —
          Details + Font size (settings-like fields) on the left, the
          receipt's own content zones (Logo/Header Notes/Item table/Footer)
          on the right, for visual consistency between the two editors even
          though this one has no drag-drop canvas. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-3.5 lg:col-span-4">
          <Card>
            <CardHeader title="Details" subtitle="Name and scope" />
            <div className="flex flex-col gap-4">
              <Input
                label="Name"
                placeholder="e.g. Counter receipt"
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
            </div>
            {formError ? <p className="mt-2 text-xs text-danger">{formError}</p> : null}
          </Card>

          <Card>
            <CardHeader title="Font size" subtitle="Base size for every line on the receipt" />
            <Input
              type="number"
              min={FONT_SIZE_PT_MIN}
              max={FONT_SIZE_PT_MAX}
              value={config.font_size_pt}
              onChange={handleFontSizeChange}
              hint={`${FONT_SIZE_PT_MIN}–${FONT_SIZE_PT_MAX}pt`}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-3.5 lg:col-span-8">
          <Card>
            <CardHeader
              title="Logo"
              subtitle="Centered at the top of every receipt"
              action={
                <Switch
                  size="sm"
                  checked={config.header.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, header: { ...config.header, enabled: checked } })
                  }
                  label="Show logo"
                />
              }
            />
            <Select
              value={config.header.size}
              onChange={(value) =>
                setConfig({
                  ...config,
                  header: { ...config.header, size: value as ThermalHeaderZoneConfig['size'] },
                })
              }
              options={LOGO_SIZE_OPTIONS}
              disabled={!config.header.enabled}
            />
          </Card>

          <Card>
            <CardHeader
              title="Business Details"
              subtitle="Name, GSTIN, address — shown at one spot only, never both"
            />
            <Select
              value={config.business_details.position}
              onChange={(value) =>
                setConfig({
                  ...config,
                  business_details: {
                    position: value as ThermalBusinessDetailsZoneConfig['position'],
                  },
                })
              }
              options={BUSINESS_DETAILS_POSITION_OPTIONS}
            />
          </Card>

          <NotesZoneField
            title="Header Notes"
            hint="Below the logo, above the items"
            zone={config.header_notes}
            onChange={(header_notes) => setConfig({ ...config, header_notes })}
          />

          <Card>
            <CardHeader title="Item table + totals" subtitle="Always fixed — never editable" />
            <div className="flex min-h-[48px] items-center justify-center rounded-control border-2 border-dashed border-border bg-surface/70 text-xs font-medium text-ink-faint">
              Computed from the order — items, tax breakdown, and total
            </div>
          </Card>

          <NotesZoneField
            title="Footer"
            hint="One full-width line, below the totals"
            zone={config.footer_notes}
            onChange={(footer_notes) => setConfig({ ...config, footer_notes })}
          />
        </div>
      </div>

      <Modal open={previewModalOpen} onOpenChange={setPreviewModalOpen} title="Preview" size="xl">
        <ThermalLayoutPreviewPane config={config} />
      </Modal>
    </div>
  );
}
