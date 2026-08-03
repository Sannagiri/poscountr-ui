import type {
  BlockType,
  DocType,
  LayoutConfig,
  SlotKey,
  TableColorTheme,
  ThermalLayoutConfig,
} from '../types/documentLayouts.types';

/** Mirrors `SLOT_KEYS` (`apps/document_layouts/constants.py`) — v3 schema, the 7 generic drag-drop slots across 2 zones. `header_left`/`header_right` are gone (the Logo zone is dedicated, not slot-based). `footer_1..4` auto-distribute width by fill count at render time (`buildDocumentPdf.ts`). */
export const SLOT_KEYS: SlotKey[] = [
  'title_row',
  'party_left',
  'party_right',
  'footer_1',
  'footer_2',
  'footer_3',
  'footer_4',
];

/** Mirrors `BlockType.values` (`apps/document_layouts/constants.py`) — v3 schema, the 6-value content-block palette a slot can be filled with. `logo`/`business_details` are gone (each is its own dedicated `LayoutConfig` zone now — `header`/`business_details` — not a palette entry, alongside `header_notes`/`payment_details`/`signature` from v2). */
export const BLOCK_TYPES: BlockType[] = [
  'party_details',
  'document_meta',
  'title',
  'notes_terms',
  'page_meta',
  'empty',
];

/** Mirrors `LOGO_POSITIONS` (`apps/document_layouts/constants.py`) — `LayoutConfig.header.position`'s valid values. */
export const LOGO_POSITIONS: LayoutConfig['header']['position'][] = ['left', 'center', 'right'];

/** Mirrors `LOGO_SIZES` (`apps/document_layouts/constants.py`) — `LayoutConfig.header.size`'s valid values. */
export const LOGO_SIZES: LayoutConfig['header']['size'][] = ['small', 'medium', 'large'];

/** Mirrors `FONT_SIZE_PT_MIN`/`FONT_SIZE_PT_MAX`/`DEFAULT_FONT_SIZE_PT` (`apps/document_layouts/constants.py`) — the builder's Font Size input's valid range. */
export const FONT_SIZE_PT_MIN = 6;
export const FONT_SIZE_PT_MAX = 14;
export const DEFAULT_FONT_SIZE_PT = 8;

/** Mirrors `TABLE_COLOR_THEMES` (`apps/document_layouts/constants.py`). */
export const TABLE_COLOR_THEMES: TableColorTheme[] = [
  'none',
  'slate',
  'blue',
  'green',
  'amber',
  'mono',
];

const QUERY_KEY_ROOT = 'documentLayouts';

/**
 * TanStack Query cache keys for this module. `list`/`resolve` are
 * parametrized by `businessId`/`documentType` (many distinct cache entries
 * can exist at once — one per filter combo a switcher/list page happens to
 * have queried), so `listRoot`/`resolveRoot` are exposed alongside them as
 * plain key *prefixes* — `invalidateQueries({ queryKey: listRoot })`
 * invalidates every parametrized `list(...)` entry in one call, since
 * TanStack Query matches by key prefix, not exact equality
 * (`useLayoutTemplateMutations.ts` relies on this after every write).
 */
export const DOCUMENT_LAYOUTS_QUERY_KEYS = {
  list: (businessId?: string, documentType?: DocType) =>
    [QUERY_KEY_ROOT, 'list', businessId ?? null, documentType ?? null] as const,
  listRoot: [QUERY_KEY_ROOT, 'list'] as const,
  detail: (id: string) => [QUERY_KEY_ROOT, 'detail', id] as const,
  resolve: (businessId: string | undefined, documentType: DocType) =>
    [QUERY_KEY_ROOT, 'resolve', businessId ?? null, documentType] as const,
  resolveRoot: [QUERY_KEY_ROOT, 'resolve'] as const,
  defaults: [QUERY_KEY_ROOT, 'defaults'] as const,
};

/**
 * Mirrors the backend's `SYSTEM_DEFAULT_LAYOUT_CONFIG`
 * (`apps/document_layouts/constants.py`) byte-for-byte in shape — the bottom
 * rung of `LayoutResolutionService.resolve_effective`'s fallback chain, so a
 * tenant with zero `LayoutTemplate` rows still renders a sensible default
 * (logo top-right, letterhead below it, party details left / document info
 * right, payment details + signature in the Meta Data zone, no header/footer
 * notes authored yet, footer placeholders empty). Used both as this
 * module's own default and as the frontend's network-failure fallback
 * (`invoicePdf.ts`/`quotationPdf.ts`/`purchaseOrderPdf.ts`'s thin wrappers
 * fall back to this whenever `resolveEffective` itself can't be reached, so
 * a broken network call never blocks document generation/preview).
 */
export const SYSTEM_DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  version: 3,
  slots: {
    title_row: { block: 'title' },
    party_left: { block: 'party_details' },
    party_right: { block: 'document_meta' },
    footer_1: { block: 'empty' },
    footer_2: { block: 'empty' },
    footer_3: { block: 'empty' },
    footer_4: { block: 'empty' },
  },
  header: { enabled: true, position: 'right', size: 'medium' },
  business_details: { enabled: true },
  header_notes: { enabled: false, text: '' },
  footer_notes: { enabled: false, text: '' },
  payment_details: { enabled: true, include: 'all' },
  signature: { enabled: true, label: 'Authorized Signatory' },
  table: { color_theme: 'mono' },
  font_size_pt: DEFAULT_FONT_SIZE_PT,
};

/** Mirrors the backend's `SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG` — Thermal Bill's much smaller config shape (no `slots`, no `business_details`/`payment_details`/`signature`, one Footer zone instead of `footer_1..4`). Used both as the Thermal Bill editor's own starting point and as `useOrderBill.ts`'s network-failure fallback. */
export const SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG: ThermalLayoutConfig = {
  version: 3,
  header: { enabled: true, size: 'medium' },
  business_details: { position: 'none' },
  header_notes: { enabled: false, text: '' },
  footer_notes: { enabled: false, text: '' },
  font_size_pt: DEFAULT_FONT_SIZE_PT,
};
