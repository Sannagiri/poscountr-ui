/**
 * Tailwind CSS configuration — the canonical source of truth for every
 * design token (color, font, spacing, radius) used across the app.
 *
 * `src/styles/*.ts` re-exports these same values for the rare case a
 * component needs a raw token in JS/TS (charts, inline SVG, canvas) instead
 * of a utility class. If a token changes, change it here first.
 *
 * Values are lifted 1:1 from the POSCountr brandbook
 * (`POSCountr/poscountr-brandbook-final.html`) — do not invent new colors
 * outside this palette (see docs/coding-standards.md, Centralized Styling System).
 *
 * Every semantic color below (brand/accent/ink/surface/border/success/
 * warning/danger) resolves through a CSS variable instead of a literal hex,
 * so `bg-surface`/`text-ink`/etc. automatically pick up dark-mode's values
 * the moment the `dark` class lands on `<html>` (see `src/styles/global.css`
 * for the actual `:root`/`.dark` variable values, and `src/hooks/useTheme.ts`
 * for what sets that class) — no component needs its own `dark:` variant for
 * the common case. `<alpha-value>` is Tailwind's own placeholder token: it
 * lets opacity utilities like `bg-brand/20` keep working through a CSS
 * variable the same way they would against a literal hex. `navy` stays
 * literal hex, unaffected by the toggle — it's the permanently-dark
 * marketing panel's own palette (`LoginMarketingPanel`), not part of the
 * light/dark system.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          light: 'rgb(var(--color-brand-light) / <alpha-value>)',
          dark: 'rgb(var(--color-brand-dark) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          light: 'rgb(var(--color-accent-light) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          mid: 'rgb(var(--color-ink-mid) / <alpha-value>)',
          soft: 'rgb(var(--color-ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--color-ink-faint) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong: 'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          bg: 'rgb(var(--color-success-bg) / <alpha-value>)',
          text: 'rgb(var(--color-success-text) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
          bg: 'rgb(var(--color-warning-bg) / <alpha-value>)',
          text: 'rgb(var(--color-warning-text) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          bg: 'rgb(var(--color-danger-bg) / <alpha-value>)',
          text: 'rgb(var(--color-danger-text) / <alpha-value>)',
        },
        navy: {
          DEFAULT: '#0B1222',
          deep: '#07090F',
          panel: '#0D1220',
          card: '#111830',
          topbar: '#1C2740',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        control: '9px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(10, 14, 26, 0.04)',
        // Slightly stronger than `card` — for surfaces that float above
        // content (menus, popovers, the date picker) instead of sitting flush
        // in the page, matching the layered-elevation feel of the Metronic
        // reference this pass is based on.
        dropdown: '0 4px 12px 0 rgba(10, 14, 26, 0.10), 0 2px 4px 0 rgba(10, 14, 26, 0.06)',
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
