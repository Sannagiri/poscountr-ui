/**
 * Design tokens — breakpoints.
 * Mirrors Tailwind's default scale plus the `xs` addition in tailwind.config.js.
 * Referenced by any component that needs a breakpoint value in JS (e.g. a
 * `matchMedia` check) rather than a Tailwind responsive prefix.
 */
export const breakpoints = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;
