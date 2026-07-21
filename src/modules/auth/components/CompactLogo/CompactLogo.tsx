/**
 * Small logo mark shown above the auth `Card` on narrow viewports, where
 * `LoginMarketingPanel` (which carries the full logo) is hidden by its own
 * `lg:hidden` breakpoint. Extracted out of `LoginPage` so `ChangePinPage`
 * can reuse the exact same mark instead of duplicating it — both screens
 * share one Card-based auth layout (docs/coding-standards.md §13).
 */
export function CompactLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect width="100" height="100" rx="24" fill="#111830" />
        <path
          d="M66 22 L30 22 Q18 22 18 34 L18 68 Q18 76 28 76"
          stroke="#5DA0FF"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="31" y="36" width="34" height="7" rx="3.5" fill="white" opacity="0.88" />
        <circle cx="70" cy="76" r="13" fill="#FF6B2B" />
        <circle cx="70" cy="76" r="6" fill="white" />
      </svg>
      <span className="font-display text-base font-black tracking-tight text-ink">
        POS<span className="text-brand">C</span>
        <span className="text-ink-faint">ountr</span>
      </span>
    </div>
  );
}
