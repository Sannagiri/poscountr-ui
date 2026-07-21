export interface ProductThumbnailProps {
  imageUrl: string;
  name: string;
  size?: 'sm' | 'md';
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-16 w-16 text-lg',
};

function initialFor(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : '?';
}

/**
 * A square product image, or — when none has been uploaded yet — a
 * same-sized square showing the product name's first letter, so the
 * Products table's image column always has *something* to align rows on
 * instead of an empty gap. Mirrors `AvatarStack`'s own image-or-initials
 * fallback, just square (products aren't people) and singular (one
 * product, not a collapsible group).
 */
export function ProductThumbnail({ imageUrl, name, size = 'sm' }: ProductThumbnailProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`shrink-0 rounded-control border border-border object-cover ${SIZE_CLASSES[size]}`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-control border border-border bg-brand/10 font-semibold text-brand ${SIZE_CLASSES[size]}`}
    >
      {initialFor(name)}
    </div>
  );
}
