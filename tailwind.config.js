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
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF6B2B',
          light: '#FF8C5A',
          dark: '#CC4A10',
        },
        accent: {
          DEFAULT: '#1A5FD4',
          light: '#4D8EFF',
          dark: '#0D3FA0',
        },
        ink: {
          DEFAULT: '#0A0E1A',
          mid: '#1C2333',
          soft: '#4B5563',
          faint: '#9CA3AF',
        },
        surface: {
          DEFAULT: '#F5F7FF',
          card: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E4E8F4',
          strong: '#C7CEE6',
        },
        success: {
          DEFAULT: '#10B981',
          bg: '#D1FAE5',
          text: '#065F46',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: '#FEF3C7',
          text: '#92400E',
        },
        danger: {
          DEFAULT: '#EF4444',
          bg: '#FEE2E2',
          text: '#991B1B',
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
