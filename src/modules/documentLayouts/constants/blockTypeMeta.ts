import type { LucideIcon } from 'lucide-react';
import { Circle, ClipboardList, FileText, Hash, Heading, Users } from 'lucide-react';

import type { BlockType, SlotKey } from '../types/documentLayouts.types';

/**
 * UI-only metadata (label + icon) for the block palette / slot cells — kept
 * separate from `documentLayouts.constants.ts` (which mirrors the backend's
 * own `constants.py` value lists verbatim, per that file's own doc comment)
 * since icons/labels have no backend equivalent to mirror.
 */
export interface BlockTypeMeta {
  label: string;
  icon: LucideIcon;
}

/**
 * One entry per `BlockType` (`BLOCK_TYPES`) — the palette + `LayoutConfigPanel`'s
 * block picker both key off this. v3 schema, 6 entries — `logo`/
 * `business_details` (each its own dedicated `LayoutConfig` zone with its
 * own inline canvas UI, `header`/`business_details`) join `header_notes`/
 * `payment_details`/`signature` (already removed in v2) as non-palette
 * zones, so none of the five have an entry here.
 */
export const BLOCK_TYPE_META: Record<BlockType, BlockTypeMeta> = {
  party_details: { label: 'Party Details', icon: Users },
  document_meta: { label: 'Document Meta', icon: FileText },
  title: { label: 'Title', icon: Heading },
  notes_terms: { label: 'Notes/Terms', icon: ClipboardList },
  page_meta: { label: 'Page Number/Date', icon: Hash },
  empty: { label: 'Empty', icon: Circle },
};

export interface SlotMeta {
  /** Short label shown inside the slot cell, e.g. `"Party · Left"`. */
  label: string;
  zone: string;
}

/** One entry per `SlotKey` (`SLOT_KEYS`) — v3 schema, the 7 generic slots across 2 zones. */
export const SLOT_META: Record<SlotKey, SlotMeta> = {
  title_row: { label: 'Title', zone: 'Title' },
  party_left: { label: 'Party · Left', zone: 'Party' },
  party_right: { label: 'Party · Right', zone: 'Party' },
  footer_1: { label: 'Footer · 1', zone: 'Footer' },
  footer_2: { label: 'Footer · 2', zone: 'Footer' },
  footer_3: { label: 'Footer · 3', zone: 'Footer' },
  footer_4: { label: 'Footer · 4', zone: 'Footer' },
};

/**
 * Zone -> slot grouping, in display order, for the canvas's slot rows. Only
 * covers the 7 generic `SlotKey` zones — the Logo/Business Details zones,
 * the Header Notes/Footer Notes text zones, the fixed item-table+totals
 * placeholder, and the Meta Data zone's two cards aren't slot-based, so
 * `LayoutGrid` renders those separately, interleaved between these rows in
 * the documented top-to-bottom order.
 */
export const LAYOUT_ZONES: { title: string; slots: SlotKey[] }[] = [
  { title: 'Title', slots: ['title_row'] },
  { title: 'Party', slots: ['party_left', 'party_right'] },
];
