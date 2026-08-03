/**
 * Types mirror the real Django serializers in `apps/document_layouts/` —
 * field names and value unions are the backend's contract, not invented
 * here (docs/coding-standards.md §25). See
 * `apps/document_layouts/serializers/{input,output}.py`,
 * `apps/document_layouts/models/{layout_template,layout_template_default}.py`.
 *
 * `SlotKey`/`BlockType`/`TableColorTheme`/`NotesTermsMode`/`LayoutConfig`/
 * `LayoutSlotConfig` are NOT redefined here — they already live in
 * `../pdf/blockRenderers/types` and `../pdf/buildDocumentPdf` (the PDF
 * renderer groundwork task), and are re-exported below so this module has a
 * single source of truth for them, per that task's own instructions.
 */

export type {
  BlockType,
  BusinessDetailsZoneConfig,
  DocType,
  HeaderZoneConfig,
  NotesTermsMode,
  NotesTermsRow,
  NotesZoneConfig,
  PaymentDetailsInclude,
  PaymentDetailsZoneConfig,
  SignatureZoneConfig,
  SlotKey,
  TableColorTheme,
  ThermalBusinessDetailsZoneConfig,
  ThermalHeaderZoneConfig,
  ThermalLayoutConfig,
} from '../pdf/blockRenderers/types';
export type { LayoutConfig, LayoutSlotConfig } from '../pdf/buildDocumentPdf';

import type { DocType, ThermalLayoutConfig } from '../pdf/blockRenderers/types';
import type { LayoutConfig } from '../pdf/buildDocumentPdf';

/**
 * A `LayoutTemplate.config`/request/effective-layout payload is either the
 * A4 shape or the Thermal Bill shape, discriminated at runtime by whichever
 * `documentTypes`/`documentType` it's actually for — TS can't narrow this
 * automatically from a generic `DocType`, so a call site that knows it's
 * only ever dealing with one specific doc type (e.g. `invoicePdf.ts`,
 * always `'invoice'`) asserts the concrete shape it already knows applies.
 */
export type AnyLayoutConfig = LayoutConfig | ThermalLayoutConfig;

/**
 * A reusable print-layout design (`LayoutTemplate` model) — optionally
 * scoped to one business (`businessId: null` means global, usable by any
 * business in the tenant). `documentTypes` is pure tagging ("this template
 * knows how to render these doc types"); which template is the *default*
 * for a given `(business|global, documentType)` pair is a separate concept
 * surfaced only through `EffectiveLayout.source`/`resolveEffective`, never a
 * flag on this type itself (mirrors `LayoutTemplateDefault` being its own
 * join table server-side).
 */
export interface LayoutTemplate {
  id: string;
  name: string;
  /** `null` = global. */
  businessId: string | null;
  documentTypes: DocType[];
  config: AnyLayoutConfig;
  /** Soft-delete flag — `false` means deactivated, no longer offered in create/default/switcher flows. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `POST /tenant/document-layouts/` body — mirrors `LayoutTemplateCreateInputSerializer`. `businessId` omitted or `null` creates a global template. */
export interface LayoutTemplateRequest {
  name: string;
  businessId?: string | null;
  documentTypes: DocType[];
  config: AnyLayoutConfig;
}

/** `PATCH /tenant/document-layouts/{id}/` body — mirrors `LayoutTemplateUpdateInputSerializer`, partial. `businessId` isn't editable after creation (no such field server-side). */
export interface LayoutTemplateUpdateRequest {
  name?: string;
  documentTypes?: DocType[];
  config?: AnyLayoutConfig;
  isActive?: boolean;
}

/** `{business_id?, document_type}` body shared by set-default/unset-default — mirrors `SetDefaultInputSerializer`. */
export interface LayoutDefaultTarget {
  businessId?: string;
  documentType: DocType;
}

/** Slim projection for the layout-switcher dropdown — mirrors `LayoutAlternativeOutputSerializer`. */
export interface LayoutAlternative {
  id: string;
  name: string;
  isGlobal: boolean;
  documentTypes: DocType[];
}

/**
 * `GET /tenant/document-layouts/resolve/`'s payload — the switcher-friendly
 * read every document preview drives off: `layout` is the resolved
 * template row (`null` for the system-default rung, where there's no row at
 * all), `config` is always populated (even on the system-default rung) so
 * callers never have to special-case `layout === null`, and `alternatives`
 * lists every other active template tagged for this doc type, scoped to
 * this business + global.
 */
export interface EffectiveLayout {
  layout: LayoutTemplate | null;
  source: 'business_default' | 'global_default' | 'system_default';
  config: AnyLayoutConfig;
  alternatives: LayoutAlternative[];
}

/**
 * One raw `LayoutTemplateDefault` row — `GET /tenant/document-layouts/defaults/`.
 * No fallback resolution applied (that's `EffectiveLayout`'s job for a
 * single scope+doc-type at a time) — this is every `(business|global,
 * documentType) -> layoutTemplateId` mapping in the tenant, in one call.
 * `businessId: null` means the tenant-wide global default.
 */
export interface LayoutTemplateDefaultRow {
  id: string;
  businessId: string | null;
  documentType: DocType;
  layoutTemplateId: string;
}
