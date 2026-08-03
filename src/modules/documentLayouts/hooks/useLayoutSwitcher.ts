import { useEffect, useState } from 'react';

import { SYSTEM_DEFAULT_LAYOUT_CONFIG } from '../constants/documentLayouts.constants';
import type { A4DocType } from '../pdf/blockRenderers/types';
import type { LayoutConfig } from '../pdf/buildDocumentPdf';
import { useEffectiveLayout } from './useEffectiveLayout';
import { useLayoutTemplate } from './useLayoutTemplate';

/** Sentinel `<Select>` value for the "no `LayoutTemplate` row at all" rung of the fallback chain — `EffectiveLayout.layout` is `null` there, so there's no real id to key the option on. */
const SYSTEM_DEFAULT_OPTION_VALUE = '__system_default__';

export interface LayoutSwitcherOption {
  value: string;
  label: string;
}

export interface UseLayoutSwitcherResult {
  /** `<Select>` options — `undefined` while the effective layout hasn't resolved yet (hide the switcher until then). */
  options: LayoutSwitcherOption[] | undefined;
  /** The currently selected option's value — the effective default until the user picks something else. `undefined` while still loading. */
  value: string | undefined;
  onChange: (value: string) => void;
  /**
   * The resolved config for the current selection — `undefined` while
   * waiting on a fetch (effective layout still loading, or a newly-picked
   * alternative's full template hasn't arrived yet). Pass straight through
   * as a `build<X>Pdf` wrapper's `layoutOverride`; `undefined` means "let
   * the wrapper resolve its own effective layout" — the same behavior as
   * before the switcher existed, so an in-flight fetch never regresses to a
   * wrong document.
   */
  layoutConfig: LayoutConfig | undefined;
  /**
   * `true` only while the user has actively picked a *non-default*
   * alternative and its full `LayoutConfig` hasn't arrived yet
   * (`useLayoutTemplate` in flight) — the one case a caller's preview effect
   * should hold off re-rendering rather than momentarily flashing back to
   * the effective default (`layoutConfig` briefly `undefined` for an
   * unrelated reason, like the very first render before `useEffectiveLayout`
   * resolves, is *not* `isPending`: that case is meant to proceed with no
   * override, same as before the switcher existed).
   */
  isPending: boolean;
}

/**
 * Powers the sevDesk-style layout switcher shared by the 3 document preview
 * modals (`OrderBillPreviewModal`/`QuotationBillPreviewModal`/
 * `PurchaseOrderBillPreviewModal`) — resolves the effective layout +
 * alternatives for a `{businessId, documentType}` pair via
 * `useEffectiveLayout`, tracks which one the user picked, and fetches the
 * full config for a non-default pick via `useLayoutTemplate`
 * (`LayoutAlternative` only carries `{id, name, isGlobal, documentTypes}`,
 * never `config` — the id alone isn't enough to render).
 *
 * `resolveEffective`'s `alternatives` list already includes the currently
 * effective template when it's a real `LayoutTemplate` row (`source` is
 * `business_default`/`global_default`) — only the `system_default` rung (no
 * row at all) needs a synthetic "System Default" option prepended so the
 * switcher never renders empty.
 *
 * `resetKey` (typically the previewed document's own id) clears the user's
 * pick back to "follow the default" whenever the modal's subject changes,
 * so a stale choice from a previously-previewed document never leaks into
 * the next one.
 */
export function useLayoutSwitcher(
  filter: { businessId?: string; documentType: A4DocType | undefined },
  resetKey: unknown,
): UseLayoutSwitcherResult {
  const effectiveQuery = useEffectiveLayout(filter);
  const effective = effectiveQuery.data;

  const [selected, setSelected] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on `resetKey` alone, not `filter`/`effective`.
  useEffect(() => {
    setSelected(null);
  }, [resetKey]);

  const defaultValue = effective
    ? (effective.layout?.id ?? SYSTEM_DEFAULT_OPTION_VALUE)
    : undefined;
  const value = selected ?? defaultValue;

  const isAlternatePick = Boolean(value) && value !== defaultValue;
  const templateQuery = useLayoutTemplate(isAlternatePick ? value : undefined);

  const options: LayoutSwitcherOption[] | undefined = effective
    ? [
        ...(effective.layout
          ? []
          : [{ value: SYSTEM_DEFAULT_OPTION_VALUE, label: 'System Default' }]),
        ...effective.alternatives.map((alt) => ({
          value: alt.id,
          label: `${alt.name}${alt.isGlobal ? ' (Global)' : ''}`,
        })),
      ]
    : undefined;

  // This hook's own 3 call sites (`QuotationBillPreviewModal`/
  // `PurchaseOrderBillPreviewModal`) only ever pass an A4 `documentType`, so
  // `effective.config`/`templateQuery.data?.config` (typed `AnyLayoutConfig`
  // — the wire shape is generic across both the A4 and Thermal Bill config
  // schemas) are safe to narrow back down to this hook's own `LayoutConfig`
  // return type.
  let layoutConfig: LayoutConfig | undefined;
  if (value === SYSTEM_DEFAULT_OPTION_VALUE) {
    layoutConfig = SYSTEM_DEFAULT_LAYOUT_CONFIG;
  } else if (value && value === effective?.layout?.id) {
    layoutConfig = effective.config as LayoutConfig;
  } else if (isAlternatePick) {
    layoutConfig = templateQuery.data?.config as LayoutConfig | undefined;
  }

  const isPending = isAlternatePick && layoutConfig === undefined;

  return { options, value, onChange: setSelected, layoutConfig, isPending };
}
