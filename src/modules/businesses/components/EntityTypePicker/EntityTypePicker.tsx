import { EntityTypeIcon } from '@/components';
import { cn } from '@/utils/cn';

import { ENTITY_TYPE_OPTIONS } from '../../constants/businesses.constants';
import type { EntityType } from '../../types/businesses.types';

export interface EntityTypePickerProps {
  value: EntityType | undefined;
  onChange: (value: EntityType) => void;
  errorMessage?: string;
  label?: string;
  /**
   * Restricts the offered options to this tenant's `allowedEntityTypes`
   * (Ultra Admin-set, `useAuthStore`'s `CurrentUser.allowedEntityTypes`).
   * Undefined shows every type (used where the caller doesn't have tenant
   * context, e.g. the import-template picker). The current `value` is always
   * kept selectable even if it falls outside the list, so editing an
   * existing business whose type was since disallowed never hides its own
   * selection.
   */
  allowedTypes?: EntityType[];
}

/**
 * Icon-per-type grid for choosing a business's `entity_type` on the create/
 * edit form — a plain text dropdown would work, but this value drives real
 * downstream behavior (restaurant → KOT/kitchen, pharmacy → batch/expiry,
 * retail → barcode, per F5) rather than being cosmetic, so it's worth being
 * instantly recognizable rather than read off a list of words. Built as a
 * plain button grid with manual `role="radiogroup"`/`role="radio"`
 * semantics instead of pulling in a Radix radio-group dependency the app
 * doesn't otherwise use — six static options don't need one.
 */
export function EntityTypePicker({
  value,
  onChange,
  errorMessage,
  label = 'Business type',
  allowedTypes,
}: EntityTypePickerProps) {
  const hasError = Boolean(errorMessage);
  const options = allowedTypes
    ? ENTITY_TYPE_OPTIONS.filter(
        (option) => option.value === value || allowedTypes.includes(option.value),
      )
    : ENTITY_TYPE_OPTIONS;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="text-xs font-semibold text-ink-soft">{label}</span> : null}
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-control border px-2 py-3 text-center transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                isSelected
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border text-ink-soft hover:border-border-strong hover:bg-surface',
              )}
            >
              <EntityTypeIcon entityType={option.value} size={18} />
              <span className="text-xs font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>
      {hasError ? <p className="text-xs text-danger">{errorMessage}</p> : null}
    </div>
  );
}
