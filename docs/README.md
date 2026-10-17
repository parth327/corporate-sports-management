# Corporate Sports Events Management — Documentation

Reference documentation for every form, database table, and API endpoint in this
application. This index tells you which document to open; each document is
self-contained and goes into full detail for its area.

## What this application is

A React/TypeScript single-page demo app, "Corporate Sports Events Management" (with a
fictional company, Apex Corporate Enterprises, and "The Colour League") — cricket, football,
the Cultural Fest, and several other events run across the
company's divisions. It has two faces:

- **A public marketing site** (`/`, `/register`) — the landing page and the
  three-step public registration form. No sign-in required.
- **An admin console** (`/console/*`) — sign-in required. Where the Main Admin
  and Event Team users manage players, teams, fixtures, results, and reporting.

## How to read these docs

| Document | Covers |
|---|---|
| [`data-model.md`](./data-model.md) | Every database table (all 20, from the source blueprint): every field, its type, nullability, and the relationships between tables. |
| [`api-reference.md`](./api-reference.md) | Every HTTP endpoint the front end calls: method, path, auth requirement, request/response shape, and the business rules the server (or the mock) enforces. |
| [`forms.md`](./forms.md) | Every form and screen in the product, numbered the way the codebase's own comments number them ("Form 1" through "Form 24"): every field, its validation, and what happens on submit. |

## The one thing to understand before reading further: THE SWITCH

This front end can run against two different backends, chosen by one
environment variable and nothing else:

```
VITE_USE_MOCK_API=true   # default — an in-memory dataset, seeded on load
VITE_USE_MOCK_API=false  # a real ASP.NET Web API, at VITE_API_BASE_URL
```

See [`.env.example`](../.env.example) for the full list of variables (auth
strategy, mock latency, PascalCase/camelCase JSON handling).

Every API endpoint in `api-reference.md` therefore has **two implementations**
that must agree:

- **The mock** — `src/api/mock/adapter.ts` and `src/api/mock/db.ts`. Enforces
  every business rule described in this documentation (capacity limits,
  double-booking checks, soft-delete, etc.) against an in-memory store seeded
  by `src/api/mock/seed.ts`.
- **The real transport** — `src/api/http.ts`. Talks to an actual ASP.NET Web
  API 4.5 backend. It does **not** enforce any business rule itself — it only
  normalises whatever error shape the server returns into one consistent
  `ApiError`. Every rule documented in `api-reference.md` as "the server
  enforces…" must be implemented server-side, or the real backend will simply
  accept requests the mock would have refused.

## Architectural facts worth knowing before you read the other docs

- **Soft delete only.** No table is ever hard-deleted from this UI. A
  `DELETE` request flips `isActive` to `false`; the row stays. See
  `data-model.md`'s "Auditable" section.
- **Role-based access is a UI courtesy, not a security boundary.** The matrix
  in `src/rbac/matrix.ts` decides what the interface *offers* a `MainAdmin` vs
  an `EventTeam` user. The real API must enforce the same matrix
  independently — a hidden button is not a permission. See the "Roles &
  permissions" section of `api-reference.md`.
- **Every table row records who created and last modified it.** `createdBy`,
  `createdOn`, `modifiedBy`, `modifiedOn` — see `Auditable` in
  `data-model.md`.
- **Season isolation.** Nearly every transactional table carries an
  `eventId`, so one year's rosters, fixtures and moderators never collide
  with the next year's.

## Where to find the code these docs describe

| Concern | Source |
|---|---|
| Data types | `src/api/types.ts` |
| Endpoint URLs | `src/api/endpoints.ts` |
| Typed resource client (`api.players.list()`, etc.) | `src/api/index.ts` |
| Mock backend + seed data | `src/api/mock/adapter.ts`, `src/api/mock/seed.ts`, `src/api/mock/db.ts` |
| Real HTTP transport | `src/api/http.ts`, `src/api/authStrategy.ts` |
| Error normalisation | `src/api/errors.ts` |
| Role/permission matrix | `src/rbac/matrix.ts` |
| Generic master-data form engine | `src/console/Crud.tsx` |
| Every console page (one form/screen per file) | `src/console/pages/*.tsx` |
| Public registration + auth screens | `src/console/pages/Registration.tsx`, `src/console/pages/auth.tsx` |
