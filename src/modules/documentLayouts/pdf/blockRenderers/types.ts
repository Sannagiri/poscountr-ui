import type { jsPDF } from 'jspdf';

import type { PaymentDetail } from '@/modules/paymentDetails';

import type { Align, LoadedLogo } from '../pdfPrimitives';
import type { ItemColumns } from '../tableRenderer';

/**
 * Shared types for every block renderer + the table renderer +
 * `buildDocumentPdf.ts`'s orchestrator. Mirrors the plan's Slot taxonomy /
 * Block palette (`.claude/plans/twinkling-strolling-pearl.md`) — the backend
 * app `apps/document_layouts` (`constants.py`) owns the authoritative
 * `SLOT_KEYS`/`BlockType` value lists; the string literal unions below are
 * this task's frontend mirror of them (the full `documentLayouts` module —
 * types/service/hooks — lands in a later task; these are scoped to what the
 * PDF renderer itself needs).
 */

export type DocType = 'invoice' | 'quotation' | 'purchase_order' | 'thermal_bill';

/** The 3 doc types `buildDocumentPdf.ts`'s A4 orchestrator actually renders — `RenderContext.docType` is always one of these (never `'thermal_bill'`, which has its own entirely separate `thermalBillPdf.ts` renderer and never constructs a `RenderContext`), so every A4-only `Record<..., DocType>` lookup (title/party/document-meta labels, preview-pane tabs, sample fixtures) can key off this narrower type instead of padding in a meaningless Thermal Bill entry. */
export type A4DocType = Exclude<DocType, 'thermal_bill'>;

/**
 * Mirrors `BlockType.values` (`apps/document_layouts/constants.py`) — v3
 * schema, 6 values. `logo`/`business_details` are deliberately gone from
 * this union (and from `BLOCK_RENDERERS`) — each now has its own dedicated
 * always-same-role zone (`LayoutConfig.header`/`business_details`, see
 * `logoBlock.ts`/`businessDetailsBlock.ts`), not a draggable palette entry,
 * so a logo can no longer end up in a footer placeholder by accident.
 * `header_notes`/`payment_details`/`signature` were already dedicated zones
 * as of v2 for the same reason.
 */
export type BlockType =
  'party_details' | 'document_meta' | 'title' | 'notes_terms' | 'page_meta' | 'empty';

/**
 * Mirrors `SLOT_KEYS` (`apps/document_layouts/constants.py`) — v3 schema, 7
 * generic drag-drop slots across 2 zones. `header_left`/`header_right` are
 * gone (the Logo zone, `LayoutConfig.header`, is dedicated and no longer
 * slot-based). `footer_1..4` auto-distribute width by how many are actually
 * filled (`buildDocumentPdf.ts`'s footer walk), so their order here is
 * left-to-right draw order, not a fixed position each keeps regardless of
 * how many neighbors are filled.
 */
export type SlotKey =
  'title_row' | 'party_left' | 'party_right' | 'footer_1' | 'footer_2' | 'footer_3' | 'footer_4';

/** Mirrors `TABLE_COLOR_THEMES` (`apps/document_layouts/constants.py`). `'none'` renders a plain black-on-white table — no header fill, no zebra striping (see `tableRenderer.ts`'s own doc comment). */
export type TableColorTheme = 'none' | 'slate' | 'blue' | 'green' | 'amber' | 'mono';

/** `NOTES_TERMS`'s own rendering mode — plain wrapped text, or a small N-row label/value table. */
export type NotesTermsMode = 'none' | 'plain_text' | 'table_2row' | 'table_3row' | 'table_4row';

/** One row of a `NOTES_TERMS` table-mode block. */
export interface NotesTermsRow {
  label: string;
  value: string;
}

/** `PAYMENT_DETAILS`'s own filter — `'all'` (default) shows every assigned detail, `'bank'`/`'upi'` narrows to one `PaymentDetailType`. */
export type PaymentDetailsInclude = 'all' | 'bank' | 'upi';

/**
 * One "who it's for" party — the customer (invoice/quotation) or the
 * supplier (purchase order). Field names are generic on purpose so
 * `partyDetailsBlock.ts` never has to know which doc type it's rendering for
 * beyond picking the right heading label.
 */
export interface RenderParty {
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  /** 2-letter Indian state code — rendered through `stateLabel()`. */
  state?: string;
  /** Only a purchase order's Supplier block shows a full postal address today. */
  addressLines?: string[];
}

/** The seller's own letterhead — business + location + tax registration. */
export interface RenderBusiness {
  businessName: string;
  /** Omitted (not just falsy) when the caller has nothing extra beyond `businessName` to show — matches `quotationPdf.ts`/`purchaseOrderPdf.ts`'s own "skip the location line when it'd just repeat the business name" fallback. */
  locationName?: string;
  addressLines?: string[];
  phone?: string;
  gstin?: string | null;
  /** 2-letter Indian state code. */
  state?: string;
}

/** The "document details" band — number/date + doc-specific extra lines, already formatted by the caller (a later task's adapter). */
export interface RenderDocumentMeta {
  number: string;
  date: string;
  /** Pre-formatted `"Label: value"` strings appended after Date, in order — e.g. invoice's Order/Place of Supply, quotation's Status/Valid until, PO's Payment/Due date. */
  extraLines?: string[];
}

/** One line of the totals summary — `tableRenderer.ts`'s totals block, not a slot/block (it's part of the fixed static zone). */
export interface RenderTotalsRow {
  label: string;
  value: string;
  bold?: boolean;
}

/**
 * The tax/totals summary below the item table. Modeled on `Invoice`'s own
 * shape (`taxableValue`/`cgst`/`sgst`/`igst`/`roundOff`/`total`/
 * `isInterstate`) since that's this task's pixel-exact reproduction target;
 * `extraRows` generalizes it enough for `quotation`'s discount line and
 * `purchase_order`'s actual-bill-amount/amount-paid/balance-due lines
 * without forcing every doc type through the CGST/SGST/IGST shape — see
 * this task's report for the reasoning.
 */
export interface RenderTotals {
  /** Defaults to `'Taxable value'` (`invoicePdf.ts`'s own label) when omitted — `quotationPdf.ts`/`purchaseOrderPdf.ts` override this to `'Subtotal'`, since neither of those documents computes a GST-taxable value the way a tax invoice does. */
  taxableValueLabel?: string;
  taxableValue: string;
  /** `true` -> render a single IGST line; `false` -> render CGST + SGST. Irrelevant when both `cgst`/`sgst` and `igst` are omitted (e.g. a future doc type with no tax split at all). */
  isInterstate: boolean;
  cgst?: string;
  sgst?: string;
  igst?: string;
  roundOff?: string;
  total: string;
  /** Extra label/value lines rendered (non-bold) between the tax lines and the bold Total line. */
  extraRows?: RenderTotalsRow[];
  /** Extra label/value lines rendered (non-bold) after the bold Total line — e.g. PO's actual bill amount / amount paid / balance due. */
  trailingRows?: RenderTotalsRow[];
  /** Only `invoicePdf.ts` renders this today ("Amount in words:" + this text) — omit to skip the line entirely. */
  amountInWordsText?: string;
}

/**
 * Everything a document needs to render, doc-type-agnostic. Built by a
 * later task's `invoicePdf.ts`/`quotationPdf.ts`/`purchaseOrderPdf.ts`
 * thin-wrapper adapters from `Invoice`/`Quotation`/`PurchaseOrder` +
 * `InvoiceSettings`/`QuotationSettings`/`PurchaseSettings` — this task only
 * defines the shape and proves `buildDocumentPdf` can render it.
 */
export interface RenderContext<TItem = unknown> {
  docType: A4DocType;

  logo: LoadedLogo | null;
  business: RenderBusiness;
  party: RenderParty;
  documentMeta: RenderDocumentMeta;

  items: TItem[];
  /** Doc-specific item-table columns (HSN only on invoice, Batch only on PO, …) — passed in rather than hardcoded so `tableRenderer.ts` never branches on `docType`. */
  buildItemColumns: (items: TItem[]) => ItemColumns<TItem>;

  totals: RenderTotals;

  /** Assigned to the order's/quotation's/PO's location — genuine per-document data (which bank/UPI accounts apply here), unlike `header_notes`/`footer_notes`/`signature.label` below. Whether/how it renders is `LayoutConfig.payment_details`'s call, not this array's. */
  paymentDetails: PaymentDetail[];
}

/** Where + how wide a block renders, plus this slot's own `props` from `LayoutConfig.slots[slotKey].props` (already merged in by `buildDocumentPdf.ts`). */
export interface SlotContext {
  x: number;
  y: number;
  width: number;
  align: Align;
  props: Record<string, unknown>;
}

/**
 * One block's draw function — returns the new cursor `y` for renderers that
 * advance a shared vertical cursor (business details, party/document-meta,
 * notes/terms, …); renderers that position themselves independently (logo)
 * still return a sensible `y` (unchanged input) so the orchestrator always
 * has a value to thread forward. `fontSizePt` is `LayoutConfig.font_size_pt`
 * — every renderer sets its own text at exactly this size (headings included,
 * distinguished by weight/style, not a bigger point size) so the whole
 * document's text is literally the same size as "the setting", not just the
 * item table. `title` (`titleBlock.ts`) is the one exception, deliberately
 * larger via `pdfPrimitives.ts`'s `scaleFontSize`.
 */
export type BlockRenderer = (
  doc: jsPDF,
  at: SlotContext,
  ctx: RenderContext,
  fontSizePt: number,
) => number;

/**
 * Where + how wide one of the semi-fixed zones (Header Notes/Footer Notes/
 * Meta Data's two cards) renders — a stripped-down `SlotContext` with no
 * `align`/`props`, since none of those zones are slots and each has its own
 * typed config instead of a free-form `props` bag.
 */
export interface ZonePosition {
  x: number;
  y: number;
  width: number;
}

/**
 * `LayoutConfig.header` — the Logo zone (v3 schema): logo-only, not a pair
 * of generic slots. `position` places it left/center/right on the page;
 * `size` picks one of `pdfPrimitives.ts`'s `LOGO_SIZE_MM` tiers, resolved at
 * draw time via `fitLogoToTier` (see `logoBlock.ts`). Repeats on every page
 * of a multi-page document, unlike every other zone in this file.
 */
export interface HeaderZoneConfig {
  enabled: boolean;
  position: 'left' | 'center' | 'right';
  size: 'small' | 'medium' | 'large';
}

/**
 * `ThermalLayoutConfig.header` — the Thermal Bill Logo zone: same
 * enable+size shape as the A4 `HeaderZoneConfig` above, minus `position` —
 * a 58mm/80mm receipt has no left/right to place it at, it's always
 * centered (matches `thermalBillPdf.ts`'s pre-existing hardcoded behavior).
 */
export interface ThermalHeaderZoneConfig {
  enabled: boolean;
  size: 'small' | 'medium' | 'large';
}

/**
 * `ThermalLayoutConfig.business_details` — the seller letterhead (business
 * name/address/phone/GSTIN/state), same content the A4 side's
 * `BusinessDetailsZoneConfig` always renders once below the Logo. On a
 * receipt it can go in either of two places instead — `'none'` renders
 * nothing, `'top'` renders it right after the Logo (above Header Notes),
 * `'footer'` renders it right before the Footer text (above the fixed
 * disclaimer line) — but never both at once, which is exactly why this is
 * one three-way `position` field rather than two independent enable
 * switches (a business explicitly asked not to be able to turn both on
 * together and see it printed twice).
 */
export interface ThermalBusinessDetailsZoneConfig {
  position: 'none' | 'top' | 'footer';
}

/**
 * `LayoutConfig`'s Thermal Bill counterpart (`apps/document_layouts/
 * constants.py`'s `SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG`) — deliberately
 * much smaller than the A4 shape: no `slots`, no `payment_details`/
 * `signature`, one Footer zone (`footer_notes`) instead of `footer_1..4`.
 * Defined here (not `thermalBillPdf.ts`, the one renderer that actually
 * consumes it) so `constants/documentLayouts.constants.ts`'s
 * `SYSTEM_DEFAULT_THERMAL_LAYOUT_CONFIG` can reference it without a
 * `documentLayouts` -> `billing` dependency running backwards.
 */
export interface ThermalLayoutConfig {
  version: number;
  header: ThermalHeaderZoneConfig;
  business_details: ThermalBusinessDetailsZoneConfig;
  header_notes: NotesZoneConfig;
  footer_notes: NotesZoneConfig;
  font_size_pt: number;
}

/**
 * `LayoutConfig.business_details` — the seller-letterhead zone (v3 schema):
 * single, always left-aligned, no right-side counterpart and no `position`
 * option (simpler than `header` above). Renders once, in normal document
 * flow — not repeated per page.
 */
export interface BusinessDetailsZoneConfig {
  enabled: boolean;
}

/** `LayoutConfig.header_notes`/`footer_notes` — one full-width zone each, free text authored directly in the layout (not per-document data). */
export interface NotesZoneConfig {
  enabled: boolean;
  text: string;
}

/** `LayoutConfig.payment_details` — the Meta Data zone's left column. Show/hide + filter only; the actual `PaymentDetail[]` rows stay genuine per-document data on `RenderContext`. */
export interface PaymentDetailsZoneConfig {
  enabled: boolean;
  include: PaymentDetailsInclude;
}

/** `LayoutConfig.signature` — the Meta Data zone's right column. `label` defaults to `"Authorized Signatory"` in the UI, but is authored per-layout, not derived from the document. */
export interface SignatureZoneConfig {
  enabled: boolean;
  label: string;
}
