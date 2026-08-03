import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names, dropping falsy values, and resolves conflicting
 * Tailwind utilities (e.g. a caller's `h-9` overriding a component's own
 * `h-10`) by keeping only the last one — `clsx` alone left both classes in
 * the DOM with the winner decided by arbitrary stylesheet order, silently
 * breaking any `className` override a component didn't explicitly design
 * around. Every component composes class names the same way through this
 * one function (docs/coding-standards.md §12).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
