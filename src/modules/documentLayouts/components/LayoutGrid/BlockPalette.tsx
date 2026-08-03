import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { BLOCK_TYPE_META } from '../../constants/blockTypeMeta';
import { BLOCK_TYPES } from '../../constants/documentLayouts.constants';
import { BlockPaletteItem } from './BlockPaletteItem';

/**
 * The block palette, now living in the editor's left sidebar column (v2
 * layout — see `LayoutEditorPage.tsx`) rather than floating above the
 * canvas. A text input filters the 8-entry palette by label — small enough
 * that filtering client-side over `BLOCK_TYPES` needs no debounce.
 */
export function BlockPalette() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return BLOCK_TYPES;
    return BLOCK_TYPES.filter((blockType) =>
      BLOCK_TYPE_META[blockType].label.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search blocks…"
          className="h-9 w-full rounded-control border border-border bg-surface-card pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {filtered.length > 0 ? (
          filtered.map((blockType) => <BlockPaletteItem key={blockType} blockType={blockType} />)
        ) : (
          <p className="text-xs text-ink-faint">No blocks match &quot;{search}&quot;.</p>
        )}
      </div>
    </div>
  );
}
