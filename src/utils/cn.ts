import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';

/**
 * Merges class names, dropping falsy values. Thin wrapper around `clsx` so
 * every component composes class names the same way (docs/coding-standards.md §12).
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
