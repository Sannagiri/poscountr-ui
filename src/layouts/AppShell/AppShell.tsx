import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/modules/auth';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

import * as Dialog from '@radix-ui/react-dialog';

/**
 * Shared chrome for every authenticated route — one shell, the sidebar
 * content changes by role (poscountr-ui-conception.md §2: "one codebase,
 * one build, three app shells selected at runtime by role"). Below `lg` the
 * sidebar becomes a slide-over drawer opened from the Topbar's hamburger
 * button — same `Sidebar` component either way, just a different `variant`
 * (docs/coding-standards.md §12: don't implement the same nav twice).
 */
export function AppShell() {
  const role = useAuthStore((state) => state.user?.role);
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Close the drawer automatically on every navigation.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  if (!role) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} variant="desktop" />

      <Dialog.Root open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 outline-none lg:hidden"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Sidebar role={role} variant="mobile" />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsMobileNavOpen(true)} />
        {/*
          Capped at a max width and centered instead of stretching edge to
          edge — on a very wide/ultra-wide monitor, letting every page
          (tables especially) fill the full viewport width just spreads
          sparse content thin instead of adapting to the screen sensibly.
          Still fully fluid below that cap, all the way down to mobile.
        */}
        {/*
          `data-scroll-root` marks this as the actual scrolling ancestor for
          the page — `DataTable`/`TenantCardGrid`'s infinite-scroll sentinel
          needs to observe intersection against *this* element (not the
          browser viewport), since this `<main>`, not `window`, is what
          scrolls.

          Neither this element nor the inner wrapper carries *top* padding —
          `PageHeader` (the first thing every routed page renders,
          docs/coding-standards.md §13) supplies its own `pt-5` as part of
          its `sticky top-0` box (see that component's own doc comment for
          why: baking it into the sticky box itself, rather than sourcing it
          from an ancestor, keeps the header's resting and stuck appearance
          pixel-identical — no snap/jump right at the scroll threshold, and
          no cross-browser ambiguity over whether a scrolling ancestor's own
          top padding counts toward a nested sticky child's `top: 0`).
          Bottom padding (`pb-5`) stays on the inner wrapper — it's normal
          trailing whitespace at the end of a page's content, nothing to do
          with the sticky header. Horizontal padding stays on `main` since
          it never interacts with vertical sticky positioning either way.
        */}
        <main data-scroll-root className="flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="mx-auto w-full max-w-[1600px] pb-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
