import { jsPDF } from 'jspdf';

import type { PaymentDetail } from '@/modules/paymentDetails';

import { BLOCK_RENDERERS } from './blockRenderers';
import { drawBusinessDetailsZone } from './blockRenderers/businessDetailsBlock';
import { drawNotesZone } from './blockRenderers/headerNotesBlock';
import { drawLogoZone, logoZoneHeightMm } from './blockRenderers/logoBlock';
import { drawPaymentDetailsCard } from './blockRenderers/paymentDetailsBlock';
import { drawSignatureCard } from './blockRenderers/signatureBlock';
import type {
  A4DocType,
  BlockType,
  BusinessDetailsZoneConfig,
  HeaderZoneConfig,
  NotesZoneConfig,
  PaymentDetailsZoneConfig,
  RenderContext,
  SignatureZoneConfig,
  SlotContext,
  SlotKey,
  TableColorTheme,
} from './blockRenderers/types';
import {
  CONTENT_WIDTH_MM,
  FOOTER_BAND_HEIGHT_MM,
  LINE_MM,
  MARGIN_MM,
  PAGE_HEIGHT_MM,
  paymentDetailLines,
  RIGHT_COLUMN_WIDTH_MM,
  RIGHT_COLUMN_X_MM,
  wrapMultilineText,
} from './pdfPrimitives';
import { drawItemsTableAndTotals } from './tableRenderer';

/**
 * The orchestrator every `build<X>Pdf` funnels through — v3 schema (see
 * `.claude/plans/twinkling-strolling-pearl.md`'s "Architecture revision v3"
 * section, and `apps/document_layouts/constants.py`, the authoritative
 * backend mirror). Walks, in top-to-bottom order: the Logo zone's own band
 * (reserved, not drawn here — see the second pass below), `title_row`, the
 * Business Details zone, `party_left`/`party_right`, Header Notes, the fixed
 * item-table+totals zone, Footer Notes, the Meta Data zone's two cards, and
 * finally the `footer_1..4` slots (deferred — see below). Driven by a
 * `LayoutConfig` — either resolved from the backend
 * (`documentLayoutsService.resolveEffective`) or
 * `../constants/documentLayouts.constants`'s `SYSTEM_DEFAULT_LAYOUT_CONFIG`
 * fallback.
 *
 * Two zones are **running headers/footers** — the Logo zone (top of every
 * page) and the `footer_1..4` row (same position on every page) — since
 * total page count isn't known until the whole document has been drawn once,
 * both are deferred into a **second pass** after the main flow finishes,
 * exactly like `page_meta` slots already were pre-v3: `doc.setPage(i)` for
 * every page `i`, then draw. Everything else (`title_row`, `party_left/
 * right`, Header Notes, the table, Footer Notes, the Meta Data zone,
 * Business Details) renders once, in normal flow, only ever on whichever
 * page it naturally falls on.
 *
 * The footer row is pinned to a fixed `FOOTER_BAND_HEIGHT_MM`-tall band at
 * the bottom of every page (`bottomLimitMm` below) rather than positioned
 * wherever the main flow happened to end on the last page — every zone that
 * can render close to the page bottom (the table/totals via
 * `drawItemsTableAndTotals`'s own `bottomReserveMm`, Footer Notes, the Meta
 * Data zone) stops short of that band and pushes to a fresh page instead of
 * running into it.
 */

export interface LayoutSlotConfig {
  block: BlockType;
  props?: Record<string, unknown>;
}

/**
 * Mirrors the backend's `LayoutTemplate.config` JSON shape
 * (`apps/document_layouts/constants.py`'s `SYSTEM_DEFAULT_LAYOUT_CONFIG`) as
 * directly received off the wire — snake_case keys stay snake_case here (not
 * run through a camelCase mapping layer, since only the top-level
 * `LayoutTemplate` fields get that treatment in `documentLayoutsService.ts`;
 * `config` itself passes through untouched). This is the single source of
 * truth for the type — `../types/documentLayouts.types.ts` re-exports it
 * rather than redefining it.
 */
export interface LayoutConfig {
  version: number;
  slots: Partial<Record<SlotKey, LayoutSlotConfig>>;
  /** The Logo zone — logo-only, repeats on every page. Not a slot. */
  header: HeaderZoneConfig;
  /** The seller-letterhead zone — always left-aligned, renders once. Not a slot. */
  business_details: BusinessDetailsZoneConfig;
  /** Full-width zone between the party row and the table — free text authored directly in the layout. */
  header_notes: NotesZoneConfig;
  /** Full-width zone between the table and the Meta Data zone — same shape as `header_notes`. */
  footer_notes: NotesZoneConfig;
  /** Meta Data zone's left column — always payment details, never a slot. */
  payment_details: PaymentDetailsZoneConfig;
  /** Meta Data zone's right column — always signature, never a slot. */
  signature: SignatureZoneConfig;
  table: { color_theme: TableColorTheme };
  /** Layout-wide base size (pt) used *literally* by every block renderer's body/heading text (table, party/business details, notes, payment/signature, page meta) — see `tableRenderer.ts`'s own doc comment for why. `titleBlock.ts`'s big document title is the one deliberate exception, still scaled larger via `pdfPrimitives.ts`'s `scaleFontSize`. */
  font_size_pt: number;
}

const LEFT_COLUMN_WIDTH_MM = RIGHT_COLUMN_X_MM - MARGIN_MM - 4;

/** `footer_1..4`, in left-to-right draw order — the footer's own deferred-render walk below distributes their width by how many are actually filled. */
const FOOTER_SLOT_KEYS: SlotKey[] = ['footer_1', 'footer_2', 'footer_3', 'footer_4'];

/** One `footer_1..4` slot's resolved draw position + which block to render there — computed once in the main flow, then replayed on every page in the second pass (see the module doc comment). */
interface DeferredFooterSlot extends SlotContext {
  block: BlockType;
}

/**
 * Generic over `TItem` (mirrors `RenderContext<TItem>`/`drawItemsTableAndTotals
 * <TItem>`) so a caller's own doc-specific item type (`OrderItem`/
 * `QuotationItem`/`PurchaseOrderItem`) flows through to its own
 * `buildItemColumns` without widening to `unknown` — TS can't otherwise
 * unify `RenderContext<OrderItem>` with a fixed `RenderContext<unknown>`
 * here, since `buildItemColumns`'s parameter position makes `TItem`
 * contravariant.
 */
export interface BuildDocumentPdfInput<TItem = unknown> {
  docType: A4DocType;
  config: LayoutConfig;
  context: RenderContext<TItem>;
}

export async function buildDocumentPdf<TItem = unknown>(
  input: BuildDocumentPdfInput<TItem>,
): Promise<Blob> {
  const { config } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Every `BlockRenderer` (per `blockRenderers/types.ts`) only ever reads
  // the doc-type-agnostic fields of `RenderContext` — never `items`/
  // `buildItemColumns` (that's `drawItemsTableAndTotals<TItem>`'s job
  // alone, called directly below with the still-fully-typed `input.context`)
  // — so this widening cast is safe: `TItem` only matters for the one
  // TItem-typed call site, and `BlockRenderer` is fixed to
  // `RenderContext<unknown>` precisely because it never needs to know it.
  const context = input.context as unknown as RenderContext;

  const getSlot = (key: SlotKey): LayoutSlotConfig => config.slots[key] ?? { block: 'empty' };

  // `page_meta` slots (wherever they're assigned among `title_row`/
  // `party_left`/`party_right` — the once-only slots) can't render correctly
  // until every page exists (see `pageMetaBlock.ts`'s doc comment) — defer
  // them to the second pass below rather than drawing them now with a
  // not-yet-final "of Y" page count. `footer_1..4` slots are handled
  // separately below (`deferredFooterSlots`) since the whole footer row
  // repeats every page now, not just any `page_meta` block inside it.
  const deferredPageMetaSlots: SlotContext[] = [];

  const renderSlot = (key: SlotKey, base: Omit<SlotContext, 'props'>): number => {
    const slot = getSlot(key);
    const at: SlotContext = { ...base, props: slot.props ?? {} };
    if (slot.block === 'page_meta') {
      deferredPageMetaSlots.push(at);
      return at.y;
    }
    const renderer = BLOCK_RENDERERS[slot.block] ?? BLOCK_RENDERERS.empty;
    return renderer(doc, at, context, config.font_size_pt);
  };

  // --- Footer: `footer_1..4`, auto-distributing width by how many are
  // actually filled (1 filled -> full width, 2 -> 50/50, 3 -> ~33 each,
  // 4 -> ~25 each), left to right in slot-key order. An `empty` slot takes
  // up none of the row's width — it's skipped entirely rather than reserving
  // its own quarter/third/half. Computed up front (not after the main flow)
  // because `footerBandHeightMm` below needs to be known before the table
  // even starts paginating. ---
  const filledFooterKeys = FOOTER_SLOT_KEYS.filter((key) => getSlot(key).block !== 'empty');

  // v3: the whole footer row is pinned to a fixed band at the bottom of
  // *every* page — like a Word document footer — rather than wherever the
  // content flow happens to end on the last page. The old flow-derived
  // position was replayed identically on every page in the second pass
  // below, which meant a Y computed for the last page's mostly-empty tail
  // would land in the middle of a continuation page still full of table
  // rows. Anchoring to the page bottom instead fixes that, but means every
  // *other* zone that can render close to the bottom (the item table/
  // totals, Footer Notes, the Meta Data zone) must now stop short of this
  // band instead of assuming the footer will simply flow in after them.
  const footerBandHeightMm = filledFooterKeys.length > 0 ? FOOTER_BAND_HEIGHT_MM : 0;
  const bottomLimitMm = PAGE_HEIGHT_MM - MARGIN_MM - footerBandHeightMm;

  // --- Logo zone: reserves a top band's worth of vertical space (its own
  // drawing is entirely deferred to the second pass below, since it repeats
  // on every page — see the module doc comment), then the title, then the
  // Business Details letterhead. `title_row` before Business Details
  // (rather than the taxonomy's literal Header-then-Title listing)
  // reproduces the pre-layout-builder hardcoded output's actual pixels
  // (title text sits above the business name there). ---
  const headerBandHeightMm = logoZoneHeightMm(config.header, context.logo);
  let y = MARGIN_MM + (headerBandHeightMm > 0 ? headerBandHeightMm + 6 : 0) + 6;
  y = renderSlot('title_row', { x: MARGIN_MM, y, width: CONTENT_WIDTH_MM, align: 'center' });
  y = drawBusinessDetailsZone(
    doc,
    { x: MARGIN_MM, y, width: CONTENT_WIDTH_MM },
    config.business_details,
    context.business,
    config.font_size_pt,
  );

  // --- Party (left) / document meta (right) — two-column band. ---
  const partyStartY = y;
  const partyLeftY = renderSlot('party_left', {
    x: MARGIN_MM,
    y: partyStartY,
    width: LEFT_COLUMN_WIDTH_MM,
    align: 'left',
  });
  const partyRightY = renderSlot('party_right', {
    x: RIGHT_COLUMN_X_MM,
    y: partyStartY,
    width: RIGHT_COLUMN_WIDTH_MM,
    align: 'left',
  });
  y = Math.max(partyLeftY, partyRightY, partyStartY) + 6;

  // --- Header Notes (full-width, dedicated zone — not a slot). Only takes
  // up space when actually enabled with text. ---
  y = advanceIfDrawn(y, (startY) =>
    drawNotesZone(
      doc,
      { x: MARGIN_MM, y: startY, width: CONTENT_WIDTH_MM },
      config.header_notes,
      config.font_size_pt,
    ),
  );

  // --- Fixed static zone: item table + totals. Never a slot. Uses
  // `input.context` (not the widened `context` above) so `TItem` stays
  // intact for `buildItemColumns`. `topReserveMm` leaves room on every
  // *continuation* page for the Logo zone's own running-header band, drawn
  // separately in the second pass below — without this, the logo would
  // land on top of a continuation page's table header row. `footerBandHeightMm`
  // reserves the same band on every page's bottom edge, so table rows/totals
  // never print underneath the pinned footer. ---
  const topReserveMm = headerBandHeightMm > 0 ? headerBandHeightMm + 6 : 0;
  y = drawItemsTableAndTotals(
    doc,
    y,
    input.context,
    config.table.color_theme,
    config.font_size_pt,
    topReserveMm,
    footerBandHeightMm,
  );

  // --- Footer Notes (full-width, dedicated zone — not a slot, same shape
  // as Header Notes but between the table and the Meta Data zone). Its own
  // height is known ahead of drawing (static authored text, not per-item),
  // so push to a fresh page rather than let it run into the footer band. ---
  if (config.footer_notes.enabled && config.footer_notes.text) {
    doc.setFontSize(config.font_size_pt);
    const footerNoteLines = wrapMultilineText(doc, config.footer_notes.text, CONTENT_WIDTH_MM);
    const footerNoteHeightMm = footerNoteLines.length * LINE_MM;
    if (y + footerNoteHeightMm > bottomLimitMm) {
      doc.addPage();
      y = MARGIN_MM + topReserveMm;
    }
  }
  y = advanceIfDrawn(y, (startY) =>
    drawNotesZone(
      doc,
      { x: MARGIN_MM, y: startY, width: CONTENT_WIDTH_MM },
      config.footer_notes,
      config.font_size_pt,
    ),
  );

  // --- Meta Data zone: Payment Details always left, Signature always
  // right — two fixed cards, not slots. Estimated ahead of drawing (same
  // reasoning as Footer Notes above) so it doesn't run into the footer band. ---
  const metaEstimateMm = Math.max(
    estimatePaymentDetailsHeightMm(config.payment_details, context.paymentDetails),
    estimateSignatureHeightMm(config.signature),
  );
  if (metaEstimateMm > 0 && y + metaEstimateMm > bottomLimitMm) {
    doc.addPage();
    y = MARGIN_MM + topReserveMm;
  }
  const metaStartY = y;
  const paymentEndY = drawPaymentDetailsCard(
    doc,
    { x: MARGIN_MM, y: metaStartY, width: LEFT_COLUMN_WIDTH_MM },
    config.payment_details,
    context.paymentDetails,
    config.font_size_pt,
  );
  const signatureEndY = drawSignatureCard(
    doc,
    { x: RIGHT_COLUMN_X_MM, y: metaStartY, width: RIGHT_COLUMN_WIDTH_MM },
    config.signature,
    context.business,
    config.font_size_pt,
  );
  y = Math.max(paymentEndY, signatureEndY, metaStartY);

  // --- Footer slots' resolved draw positions — pinned to `bottomLimitMm`
  // (the fixed band reserved above) rather than wherever `y` ended up, so
  // the same coordinates replay correctly on every page in the second pass
  // below, independent of how much content precedes them on any given page. ---
  const deferredFooterSlots: DeferredFooterSlot[] = [];
  if (filledFooterKeys.length > 0) {
    const footerStartY = bottomLimitMm + 4;
    const footerWidth = CONTENT_WIDTH_MM / filledFooterKeys.length;
    let footerX = MARGIN_MM;
    for (const key of filledFooterKeys) {
      const slot = getSlot(key);
      deferredFooterSlots.push({
        x: footerX,
        y: footerStartY,
        width: footerWidth,
        align: 'left',
        props: slot.props ?? {},
        block: slot.block,
      });
      footerX += footerWidth;
    }
  }

  // --- Second pass: the Logo zone, `footer_1..4`, and any `page_meta`
  // slot among `title_row`/`party_left`/`party_right` — all three can only
  // render correctly once every page already exists (`doc.getNumberOfPages()`
  // is otherwise not yet final), and the Logo zone + footer additionally
  // need to repeat on every page, not just whichever page they'd have
  // landed on in a single top-to-bottom pass. ---
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawLogoZone(doc, config.header, context.logo);
    for (const at of deferredPageMetaSlots) {
      BLOCK_RENDERERS.page_meta(doc, at, context, config.font_size_pt);
    }
    for (const footerSlot of deferredFooterSlots) {
      const renderer = BLOCK_RENDERERS[footerSlot.block] ?? BLOCK_RENDERERS.empty;
      renderer(doc, footerSlot, context, config.font_size_pt);
    }
  }

  return doc.output('blob');
}

/** Ahead-of-draw height estimate for the Meta Data zone's Payment Details card — mirrors `paymentDetailsBlock.ts`'s own layout arithmetic exactly (same `paymentDetailLines` call) so the page-break check above matches what actually renders. `0` when the card would render nothing (matches `drawPaymentDetailsCard`'s own early-return). */
function estimatePaymentDetailsHeightMm(
  zone: PaymentDetailsZoneConfig,
  paymentDetails: PaymentDetail[],
): number {
  if (!zone.enabled) return 0;
  const details =
    zone.include === 'all'
      ? paymentDetails
      : paymentDetails.filter((d) => d.detailType === zone.include);
  if (details.length === 0) return 0;
  let heightMm = 5.5;
  for (const detail of details) {
    heightMm += paymentDetailLines(detail).length * LINE_MM + 1.5;
  }
  return heightMm + 2;
}

/** Ahead-of-draw height estimate for the Meta Data zone's Signature card — mirrors `signatureBlock.ts`'s own fixed layout arithmetic (heading + "For {business}" + blank space + label line). `0` when disabled. */
function estimateSignatureHeightMm(zone: SignatureZoneConfig): number {
  if (!zone.enabled) return 0;
  return 5.5 + LINE_MM * 4 + 2;
}

/** Runs `draw` at `startY` and adds a small trailing gap only if it actually drew something (i.e. its own end `y` moved past `startY`) — shared by the Header Notes / Footer Notes zone calls above so a disabled/empty zone never reserves dead vertical space. */
function advanceIfDrawn(startY: number, draw: (y: number) => number): number {
  const endY = draw(startY);
  return endY > startY ? endY + 4 : startY;
}
