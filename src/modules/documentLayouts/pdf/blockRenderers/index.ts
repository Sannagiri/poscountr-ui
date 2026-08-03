import { documentMetaBlock } from './documentMetaBlock';
import { notesTermsBlock } from './notesTermsBlock';
import { pageMetaBlock } from './pageMetaBlock';
import { partyDetailsBlock } from './partyDetailsBlock';
import { titleBlock } from './titleBlock';
import type { BlockRenderer, BlockType } from './types';

/** `'empty'` — the palette's explicit no-op, distinct from a slot simply being left out of `config.slots`. */
const emptyBlock: BlockRenderer = (_doc, at) => at.y;

/**
 * Every block renderer, keyed by `BlockType` — `buildDocumentPdf.ts` looks
 * up `config.slots[slotKey].block` here for each of the 7 generic slots
 * (v3 schema). `logoBlock.ts`/`businessDetailsBlock.ts`/`headerNotesBlock.ts`/
 * `paymentDetailsBlock.ts`/`signatureBlock.ts` deliberately have no entry
 * here — those five zones are dedicated `LayoutConfig` keys (`header`/
 * `business_details`/`header_notes`/`footer_notes`/`payment_details`/
 * `signature`), not draggable blocks, so `buildDocumentPdf.ts` calls their
 * (adapted) drawing functions directly instead of going through this slot
 * lookup.
 */
export const BLOCK_RENDERERS: Record<BlockType, BlockRenderer> = {
  party_details: partyDetailsBlock,
  document_meta: documentMetaBlock,
  title: titleBlock,
  notes_terms: notesTermsBlock,
  page_meta: pageMetaBlock,
  empty: emptyBlock,
};

export * from './types';
