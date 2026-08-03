import { DatePicker, Select } from '@/components';

import type { DatePreset } from '../constants/reportsFilters.constants';
import { DATE_PRESET_OPTIONS } from '../constants/reportsFilters.constants';
import type { ReportsFilters } from '../hooks/useReportsFilters';

// Radix `Select.Item` forbids an empty-string `value` (reserved internally
// for "nothing selected"), so the "All locations" option can't literally be
// `''` the way `selectedLocationId`'s own "unset" convention is elsewhere —
// translated at this boundary only, `useReportsFilters`'s `''`-means-unset
// contract stays untouched.
const ALL_LOCATIONS_VALUE = '__all__';

export interface ReportsToolbarProps {
  filters: ReportsFilters;
  /** Renders an "All locations" + per-location Select, sourced from `filters.scopedLocations`, right after the business Select. Compare Reports only — every other page has no use for narrowing by a single location yet. @default false */
  showLocationSelect?: boolean;
}

/** Date preset (+ conditional from/to range), business selector, and (opt-in) location selector — shared by every Reports page, driven by `useReportsFilters`. */
export function ReportsToolbar({ filters, showLocationSelect = false }: ReportsToolbarProps) {
  const {
    datePreset,
    setDatePreset,
    rangeFrom,
    setRangeFrom,
    rangeTo,
    setRangeTo,
    isTenantAdmin,
    businessesQuery,
    selectedBusinessId,
    setSelectedBusinessId,
    scopedLocations,
    selectedLocationId,
    setSelectedLocationId,
  } = filters;

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <Select
        className="w-auto min-w-[9.5rem]"
        value={datePreset}
        onChange={(value) => setDatePreset(value as DatePreset)}
        options={DATE_PRESET_OPTIONS}
      />
      {datePreset === 'range' ? (
        <>
          <DatePicker
            value={rangeFrom}
            onChange={setRangeFrom}
            placeholder="From"
            className="w-auto min-w-[9.5rem]"
          />
          <span className="text-xs text-ink-faint">to</span>
          <DatePicker
            value={rangeTo}
            onChange={setRangeTo}
            placeholder="To"
            className="w-auto min-w-[9.5rem]"
          />
        </>
      ) : null}
      {isTenantAdmin && businessesQuery.data?.length ? (
        <Select
          className="w-auto min-w-[9.5rem]"
          value={selectedBusinessId}
          onChange={(value) => setSelectedBusinessId(value)}
          options={businessesQuery.data.map((business) => ({
            value: business.id,
            label: business.name,
          }))}
        />
      ) : null}
      {showLocationSelect && isTenantAdmin && scopedLocations.length > 0 ? (
        <Select
          className="w-auto min-w-[9.5rem]"
          value={selectedLocationId || ALL_LOCATIONS_VALUE}
          onChange={(value) => setSelectedLocationId(value === ALL_LOCATIONS_VALUE ? '' : value)}
          options={[
            { value: ALL_LOCATIONS_VALUE, label: 'All locations' },
            ...scopedLocations.map((location) => ({ value: location.id, label: location.name })),
          ]}
        />
      ) : null}
    </div>
  );
}
