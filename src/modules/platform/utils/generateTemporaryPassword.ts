/**
 * Deterministic, reconstructable temporary password for a new business's
 * first owner login: first 3 letters of the business slug (hyphens
 * stripped) + the current year + "@" — e.g. slug `la-rosatta` in 2026 ->
 * `lar2026@`. Same input always produces the same output on purpose (per
 * direct request): if it's forgotten, anyone who knows the business's slug
 * and roughly when it was created can reconstruct it without it having been
 * written down anywhere. Padded with `x` so it never falls short of the
 * backend's 8-character minimum even for a very short slug.
 */
export function generateTemporaryPassword(
  slug: string,
  year: number = new Date().getFullYear(),
): string {
  const letters = slug.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const prefix = letters.slice(0, 3).padEnd(3, 'x');
  return `${prefix}${year}@`;
}
