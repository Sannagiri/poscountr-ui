# POSCountr-UI

The POSCountr web client — React + TypeScript + Tailwind CSS, built to the
coding standards in [`docs/coding-standards.md`](./docs/coding-standards.md).

This is the **real project**. Conception, screen mockups, and phase-by-phase
planning live in the sibling `POSCountr-UI-Planning` folder — that folder
stays docs-only; this one is where the app is actually built, phase by
phase, per `POSCountr-UI-Planning/poscountr-ui-execution-roadmap.md`.

## Stack

- React 18 + TypeScript (strict mode), built with Vite
- Tailwind CSS, tokens lifted from the POSCountr brandbook (`src/styles/`, `tailwind.config.js`)
- TanStack Query for server state, Zustand for the auth session, React Hook Form + Zod for forms
- React Router (data router) with role-based route guards
- Vitest + React Testing Library
- ESLint + Prettier + Husky + lint-staged
- Docker (multi-stage, nginx production image)

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit VITE_API_BASE_URL if needed
npm run dev                  # http://localhost:3200
```

## Scripts

| Script                            | What it does                                |
| --------------------------------- | ------------------------------------------- |
| `npm run dev`                     | Vite dev server with HMR                    |
| `npm run build`                   | Type-check (`tsc -b`) then production build |
| `npm run preview`                 | Serve the production build locally          |
| `npm run lint` / `lint:fix`       | ESLint, zero warnings required              |
| `npm run format` / `format:check` | Prettier                                    |
| `npm run typecheck`               | `tsc -b --noEmit`                           |
| `npm run test` / `test:watch`     | Vitest                                      |

## Folder structure

Follows `docs/coding-standards.md` §2–§4 (centralized styling, module-based
folders, shared component library):

```txt
src/
  components/       # shared, reusable UI (Button, Card, DataTable, Modal, ...)
  config/           # env.ts — validated access to VITE_* variables
  layouts/
    AppShell/         # Sidebar + Topbar + role-filtered nav — the authenticated shell
  modules/
    auth/             # two-step login, PIN pad, session store, change-pin — built
    dashboard/        # owner/manager home — built (data currently mocked, see its README)
    platform/         # Ultra Admin console — businesses + platform dashboard built, rest scaffolded (see platform/README.md)
    businesses/       # scaffold only — F3
    team/             # scaffold only — F4
    inventory/        # scaffold only — F5
    billing/          # scaffold only — F6
    reports/          # scaffold only — F7
    settings/         # scaffold only — F7
  routes/           # router.tsx + role guards (RequireAuth, RequireRole)
  services/         # apiClient.ts — the one Axios instance every module's services call through
  styles/           # theme.ts + colors/typography/spacing/breakpoints (mirrors tailwind.config.js)
  types/            # cross-cutting types (api.ts — the backend's response envelope)
  utils/            # cn(), status.ts, ...
```

Each stub module (`platform`, `businesses`, `team`, `inventory`, `billing`,
`reports`, `settings`) has its own `README.md` naming the roadmap phase it's
built in and the standard subfolders it will grow
(`components/pages/hooks/services/types/constants/utils/validations/data`).
Their routes are already wired to a shared `ComingSoonPage` placeholder so
navigation is real end-to-end today.

## Environment variables

See `.env.example` (local), `.env.stage.example`, `.env.production.example`.
Only `VITE_*`-prefixed variables reach the client (Vite requirement) and
they are baked in **at build time** — one build per stage, not one image
reconfigured at boot. See
`POSCountr-UI-Planning/poscountr-ui-docker-plan.md` §4 for why.

| Variable            | Meaning                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Base URL of the POSCountr API this build talks to, including `/api/v1` |
| `VITE_APP_STAGE`    | `local` \| `stage` \| `production` — informational only                |

## Docker

```bash
# Local dev (hot reload)
docker compose -f docker-compose.local.yml up

# Stage / production images (multi-stage build → nginx)
docker compose -f docker-compose.stage.yml up --build
docker compose -f docker-compose.production.yml up --build
```

`docker/Dockerfile` is the dev image; `docker/Dockerfile.production` is the
two-stage production build (Node build stage → nginx serve stage) per
`docs/coding-standards.md` §20. `docker/nginx.conf` handles the SPA routing
fallback, asset caching, and baseline security headers.

## What's built vs. scaffolded

- **Built:** tooling (Vite/TS/Tailwind/ESLint/Prettier/Husky/Vitest), the
  shared component library, the centralized API client + auth session
  store, the two-step Login + forced Change-PIN flow, the app shell
  (Sidebar/Topbar), the Dashboard page, routing with role guards for every
  module route, and — first pass of Platform Console — the ultra_admin
  Platform dashboard and the Businesses screen (list/create/suspend/activate
  tenants, with the first tenant_admin created alongside each new business).
- **Scaffolded (routes wired, screens pending):** License plan management,
  Platform admins, Audit log (rest of Platform Console), Businesses &
  Locations (tenant-scoped), Team, Inventory, Billing/KDS, Reports, Settings
  — each is built out in its own roadmap phase (F2–F7 in
  `POSCountr-UI-Planning/poscountr-ui-execution-roadmap.md`), following the
  same discuss → build → verify → checkpoint protocol used on the backend.

## Coding standards

Every file in this project is written to
[`docs/coding-standards.md`](./docs/coding-standards.md) — centralized
styling, module-based folders, reusable components, typed API layer,
naming conventions, accessibility, and the production Docker requirements.
Read that file before adding to or changing this codebase.
