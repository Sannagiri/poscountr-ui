import type { LucideIcon } from 'lucide-react';
import { Coffee, Package, Pill, ShoppingBag, ShoppingCart, UtensilsCrossed } from 'lucide-react';

export interface EntityTypeIconProps {
  /**
   * A business's `entity_type` (the backend's `EntityType` enum value —
   * restaurant/retail/pharmacy/grocery/cafe/other). Typed as a plain
   * `string`, not a union imported from the businesses module, the same way
   * `toneForStatus`/`statusLabel` (`src/utils/status.ts`) stay generic
   * rather than depending on a specific module's types — this is a shared
   * UI component (`src/components`), and nothing in `src/components` should
   * import from `src/modules/*`.
   */
  entityType: string;
  size?: number;
  className?: string;
}

/**
 * One icon per business `entity_type` — the single place that mapping lives
 * (docs/coding-standards.md §12/§13, "don't implement the same concept in
 * different ways"), reused wherever a business's type needs a quick visual
 * identifier: the entity-type picker on the create/edit form and business
 * cards in F3, later F5's entity-type-aware product forms.
 */
const ENTITY_TYPE_ICONS: Record<string, LucideIcon> = {
  restaurant: UtensilsCrossed,
  retail: ShoppingBag,
  pharmacy: Pill,
  grocery: ShoppingCart,
  cafe: Coffee,
  other: Package,
};

export function EntityTypeIcon({ entityType, size = 16, className }: EntityTypeIconProps) {
  const Icon = ENTITY_TYPE_ICONS[entityType] ?? Package;
  return <Icon size={size} className={className} />;
}
