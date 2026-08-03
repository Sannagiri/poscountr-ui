import { FileText } from 'lucide-react';

import { Card, CardHeader, Select } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useEffectiveLayout } from '../../hooks/useEffectiveLayout';
import { useLayoutTemplateMutations } from '../../hooks/useLayoutTemplateMutations';
import type { DocType } from '../../types/documentLayouts.types';

/** Sentinel `<Select>` value for "no `LayoutTemplateDefault` row at all" — mirrors `useLayoutSwitcher.ts`'s own sentinel for the same rung. */
const SYSTEM_DEFAULT_OPTION_VALUE = '__system_default__';

export interface DefaultLayoutSelectorProps {
  /** The business this default applies to — every settings page this renders on already has one selected before showing its content, so this is never actually `undefined` at render time. */
  businessId: string;
  documentType: DocType;
  /** Plural, lowercase — e.g. "invoices"/"quotations"/"purchase orders" — for the subtitle copy. */
  documentLabel: string;
}

/**
 * Picks which `LayoutTemplate` this business defaults to for `documentType`
 * — the settings-page home for what used to be the layout editor page's own
 * "Default status" card (`LayoutEditorPage.tsx`'s doc comment/git history).
 * Moved here because a tenant admin thinks "what layout does this business's
 * invoices print with" from the Invoices settings page, not from inside a
 * specific layout's own editor — and unlike the editor (which only offered
 * "make *this* layout the default"), a `<Select>` here can offer every
 * eligible layout (`EffectiveLayout.alternatives`, the same list the
 * document-preview switcher already offers) in one place.
 *
 * Reuses `resolveEffective` (via `useEffectiveLayout`) for both the current
 * value and the option list — `alternatives` already includes the
 * currently-effective template when it's a real row, so no separate
 * `useLayoutTemplates` fetch is needed (see `useLayoutSwitcher.ts`'s own
 * doc comment for the same reasoning).
 *
 * Unlike `useLayoutSwitcher.ts` (which only adds the "Built-in system
 * default" sentinel option when there's no real row at all — a switcher is
 * just previewing, and "revert to system default" isn't a meaningful pick
 * once a real default already exists), this selector's whole point is
 * letting an admin *unset* a default they've already set — so the sentinel
 * is always offered, not just when the business is already on that rung.
 */
export function DefaultLayoutSelector({
  businessId,
  documentType,
  documentLabel,
}: DefaultLayoutSelectorProps) {
  const effectiveQuery = useEffectiveLayout({ businessId, documentType });
  const { setDefaultLayoutTemplate, unsetDefaultLayoutTemplate } = useLayoutTemplateMutations();

  const effective = effectiveQuery.data;
  const value = effective ? (effective.layout?.id ?? SYSTEM_DEFAULT_OPTION_VALUE) : undefined;
  const options = effective
    ? [
        { value: SYSTEM_DEFAULT_OPTION_VALUE, label: 'Built-in system default' },
        ...effective.alternatives.map((alternative) => ({
          value: alternative.id,
          label: `${alternative.name}${alternative.isGlobal ? ' (Global)' : ''}`,
        })),
      ]
    : [];

  const isMutating = setDefaultLayoutTemplate.isPending || unsetDefaultLayoutTemplate.isPending;

  function handleChange(next: string) {
    if (next === value) return;
    const target = { businessId, documentType };
    if (next === SYSTEM_DEFAULT_OPTION_VALUE) {
      // Nothing to unset if this business is already falling through to the
      // global/system rung — `effective.layout` is only non-null when a
      // real business or global default row exists.
      if (effective?.layout) unsetDefaultLayoutTemplate.mutate({ id: effective.layout.id, target });
    } else {
      setDefaultLayoutTemplate.mutate({ id: next, target });
    }
  }

  return (
    <Card>
      <CardHeader
        icon={FileText}
        title="Default print layout"
        subtitle={`Which layout renders ${documentLabel} for this business — design layouts themselves under Administration → Print Layouts`}
      />
      {effectiveQuery.isLoading ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : effectiveQuery.isError ? (
        <p className="text-sm text-danger">{describeApiError(effectiveQuery.error)}</p>
      ) : (
        <Select value={value} onChange={handleChange} options={options} disabled={isMutating} />
      )}
    </Card>
  );
}
