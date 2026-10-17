# Corporate Sports Events Management — Portal & Operating Console

A demo events portal for a fictional company, **Apex Corporate Enterprises**, and the
console that runs the season behind it: registration, classification, teams,
allocation, competition groups, fixtures, results, dashboards and exports.

One application, three surfaces:

| Route | What it is | Who sees it |
| --- | --- | --- |
| `/` | The public portal — one long scroll through the season over a live 3D stadium | Everyone |
| `/login`, `/forgot-password`, `/reset-password` | Authentication | Everyone |
| `/console/**` | The operating console | Main Admin, Management Team, Event Management |
| `/lab/team-builder` | A front-end prototype: the spatial 3D team builder (see "The team builder lab") | Everyone; nothing is saved |

There is no `/register`: participants arrive from the HR feed, so self-registration
was removed (the route answers with the 404 page).

React 18 + Vite + TypeScript + Tailwind + Framer Motion, with React Three Fiber
and Lenis on the public page, structured to connect to an **ASP.NET Web API 4.5**
backend. It currently runs on a seeded in-memory dataset; switching to the real
API is one environment variable.

**Full reference documentation** — every table, every API endpoint, and every
form in detail — lives in [`docs/`](./docs/README.md).

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run typecheck  # tsc --noEmit
npm run build      # typecheck, then production build into dist/
npm run preview    # serve dist/ locally
```

### Sign in

The demo dataset ships four accounts. **The password for every one is `demo2026`.**

| Username | Role | Scope |
| --- | --- | --- |
| `admin` | Main Admin | Every group and sub-group |
| `cricket` | Event Team | Cricket only |
| `football` | Event Team | Football only |
| `sarjana` | Event Team | Cultural-1 only |

Sign in as `admin` to see everything; sign in as `cricket` to see what scoping
actually does — the sidebar loses the administration section, the dashboard
figures change, and `/console/admin/users` returns a written refusal rather than
silently disappearing.

---

## Connecting the real API

**This is the only thing you have to change.** Copy `.env.example` to `.env`:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=https://localhost:44301
VITE_AUTH_STRATEGY=bearer
```

`src/api/index.ts` picks the transport on that one flag:

```ts
const transport = config.useMockApi ? mockTransport : httpTransport;
```

Nothing above that line knows which one it got. Every screen, hook and form is
identical either way.

### What the mock is, and what it is not

`src/api/mock/` is a real little database, not a pile of fixtures. It paginates,
searches, sorts, filters by foreign key, soft-deletes, writes an audit trail and
**enforces all six business constraints** — so the UI's error paths get exercised
during development instead of being discovered in production.

Two things to know:

- **It lives in memory and resets on page reload.** Anything you create survives
  client-side navigation but not F5. That is deliberate: every reload gives you
  the same known season back.
- **The season is generated deterministically** from a fixed seed, so two people
  running the app see byte-identical data and a screenshot stays accurate.

### If your routes differ

All URLs live in **`src/api/endpoints.ts`** and nowhere else. The defaults assume
a conventional `api/{controller}/{id}` route, so `GroupsController` serves
`/api/groups`. Change them there.

### If your JSON is PascalCase

Web API serialises C# `GroupName` as `GroupName` unless you tell it otherwise.
Either add the resolver in `WebApiConfig.cs`:

```csharp
config.Formatters.JsonFormatter.SerializerSettings.ContractResolver =
    new CamelCasePropertyNamesContractResolver();
```

…or set `VITE_NORMALISE_CASING=true`, which turns on a recursive key re-caser in
`src/api/http.ts`. The first option is better: it fixes the problem once, on the
wire, rather than on every response.

### What each endpoint must return

A list endpoint returns an envelope:

```json
{ "items": [ ... ], "total": 284, "page": 1, "pageSize": 12 }
```

and accepts `page`, `pageSize`, `search`, `isActive`, `sortBy`, `sortDir` plus any
foreign key as a filter (`?subGroupId=1`). `POST` returns the created row,
`PUT /{id}` returns the updated row, and **`DELETE /{id}` is a soft delete** — it
flips `isActive` and returns the row. Nothing is ever physically removed.

### Errors

`src/api/errors.ts` normalises all three Web API failure shapes into one
`ApiError`:

- `ModelState` validation → `fieldErrors`, which forms map back onto the offending
  input automatically
- `HttpError` (`Message` / `ExceptionMessage`)
- OAuth `{ error, error_description }` from `/token`

### Auth

The scheme was left open, so both are written behind one interface in
`src/api/authStrategy.ts`:

- **`bearer`** (default) — `POST /token` with a form-encoded OAuth password grant,
  then `Authorization: Bearer …`. This is the Web API 4.5 default.
- **`cookie`** — `POST /api/account/login`, then `credentials: 'include'` on every
  request. Needs CORS with `AllowCredentials` and an explicit origin; a wildcard
  origin is rejected by browsers once credentials are on.

Flip `VITE_AUTH_STRATEGY`. A `401` from anywhere clears the session exactly once,
via the handler `AuthProvider` registers with `setUnauthorizedHandler`.

---

## Layout

```
src/
├── main.tsx                  Entry point — mounts BrowserRouter
├── App.tsx                   Every route; lazy-loads each screen
│
├── api/                      ── the seam ──
│   ├── index.ts              Picks the transport; exposes `api`, `auth`, download
│   ├── types.ts              All 20 tables as interfaces. Start here.
│   ├── endpoints.ts          Every URL, in one place
│   ├── config.ts             Environment flags
│   ├── http.ts               Real transport (fetch + error normalisation)
│   ├── authStrategy.ts       bearer | cookie, behind one interface
│   ├── tokenStore.ts         Session persistence
│   ├── errors.ts             ApiError + Web API error normalisation
│   └── mock/
│       ├── seed.ts           A whole deterministic season
│       ├── db.ts             Mutable in-memory store + query engine
│       └── adapter.ts        Mock transport + the six business constraints
│
├── hooks/
│   ├── useResource.ts        useList / useRecord / useOptions / useMutation
│   ├── useAuth.tsx           Session + capability checks
│   └── useToast.tsx          Notifications
│
├── rbac/matrix.ts            Section 07 of the blueprint, as data
│
├── ui/                       Design system
│   ├── primitives.tsx        Field, Input, Select, Chips, Button, Badge, Card…
│   ├── DataTable.tsx         One table for all nineteen list screens
│   ├── Modal.tsx             Focus-trapped dialog + ConfirmDialog
│   └── charts.tsx            Bar, donut, line, stat tile, fill meters
│
├── console/
│   ├── ConsoleLayout.tsx     Sidebar + topbar shell
│   ├── RequireAuth.tsx       Sign-in gate + capability gate
│   ├── nav.ts                Information architecture + capability declarations
│   ├── Crud.tsx              Config-driven CRUD engine
│   └── pages/                The blueprint's forms
│
├── site/                     The public portal
│   ├── Landing.tsx           Composition, smooth scroll, readability scrim
│   ├── ChapterRail.tsx       The chapter spine on wide screens
│   └── RegisterCta.tsx       How participants get into an event
│
├── three/
│   ├── StadiumBackdrop.tsx   Fixed layer: CSS stand-in, lazy canvas, fade-in
│   └── stadium/              The procedural stadium (see "The stadium" below)
│
├── lab/team-builder/         The spatial team builder (see "The team builder lab")
│
├── lib/
│   ├── smoothScroll.ts       Lenis + in-page link handling
│   ├── narrative.ts          Scroll position → chapter (drives camera and rail)
│   └── signals.js, hooks.js  DOM ↔ WebGL signals, media queries, tiers
│
├── components/               Landing sections
└── _superseded/              Replaced files, kept for reference. Safe to delete.
```

---

## Where each form lives

The blueprint specifies twenty-four forms. Twenty-two are built; the two that
served public self-registration were removed with it.

| # | Form | File |
| --- | --- | --- |
| 1 | Public registration (3 steps) | Removed — participants come from the HR feed |
| 2 | Login | `console/pages/auth.tsx` → `LoginPage` |
| 3 | Forgot password | `console/pages/auth.tsx` → `ForgotPasswordPage` |
| 4 | Reset password | `console/pages/auth.tsx` → `ResetPasswordPage` |
| 5 | Change password / my profile | `console/pages/auth.tsx` → `ProfilePage` |
| 6 | GroupMaster | `console/pages/masters.tsx` → `GroupsPage` |
| 7 | SubGroupMaster | `console/pages/masters.tsx` → `SubGroupsPage` |
| 8 | PlayerSubTypeMaster | `console/pages/masters.tsx` → `PlayerTypesPage` |
| 9 | PlayerSubTypeDetail | `console/pages/masters.tsx` → `PlayerTypeDetailsPage` |
| 10 | RuleCard | `console/pages/masters.tsx` → `RulesPage` |
| 11 | EventMaster / SeasonMaster | `console/pages/masters.tsx` → `EventsPage` |
| 12 | UserAccount | `console/pages/masters.tsx` → `UsersPage` |
| 13 | RolePermission | `console/pages/admin.tsx` → `PermissionsPage` |
| 14 | UmpireMaster | `console/pages/masters.tsx` → `UmpiresPage` |
| 15 | EventTeamMaster | `console/pages/masters.tsx` → `EventTeamPage` |
| 16 | PlayerMaster add / edit | `console/pages/players.tsx` → `PlayersPage` |
| 17 | Player review & activate | Removed with self-registration; `status` is edited on the register (`players.tsx`) |
| 18 | TeamMaster | `console/pages/competition.tsx` → `TeamsPage` |
| 19 | TeamAllocation | `console/pages/Allocation.tsx` |
| 20 | TeamGroupMaster | `console/pages/competition.tsx` → `TeamGroupsPage` |
| 21 | TeamGroupDetail | `console/pages/competition.tsx` → `GroupMembershipDialog` |
| 22 | ScheduleMaster — new fixture | `console/pages/Schedule.tsx` |
| 23 | MatchResult / score entry | `console/pages/Results.tsx` |
| 24 | Export & dashboard filter | `console/pages/Reports.tsx` |

Plus a read-only audit log at `console/pages/admin.tsx` → `AuditPage`.

---

## Adding a master-data screen

Twelve of those forms are the same shape — a filtered list, a create/edit dialog,
a deactivate confirm. Writing them twelve times would mean twelve places for the
soft-delete rule to drift, so they are **declared**, not written:

```tsx
<CrudScreen
  eyebrow="Master setup"
  title="Venues"
  entity="Venue"
  resource={api.venues}
  idField="venueId"
  capability="groups"
  scopeField="subGroupId"          // pins an Event Team user to their sub-group
  columns={[
    { key: 'venueName', header: 'Venue', primary: true,
      render: (r) => <span className="font-semibold text-white">{r.venueName}</span> },
    { key: 'capacity', header: 'Capacity', align: 'right',
      render: (r) => <span className="tabular-nums">{r.capacity}</span> },
  ]}
  fields={[
    { name: 'venueName', label: 'Venue name', type: 'text', required: true },
    { name: 'capacity', label: 'Capacity', type: 'number', min: 0 },
    { name: 'subGroupId', label: 'Sub-group', type: 'select', required: true,
      source: { resource: api.subGroups, valueKey: 'subGroupId', labelKey: 'subGroupName' } },
    { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
  ]}
/>
```

The engine supplies pagination, debounced search, the active/inactive filter,
validation, server-error mapping, scope pinning and the soft-delete confirm.

**Dependent dropdowns** — add `dependsOn` and `query`:

```ts
{
  name: 'playerSubTypeDetailId', label: 'Sub-type detail', type: 'select',
  source: {
    resource: api.playerSubTypeDetails,
    valueKey: 'playerSubTypeDetailId', labelKey: 'detailName',
    dependsOn: 'playerSubTypeId',
    query: (values) => ({ playerSubTypeId: Number(values.playerSubTypeId) || undefined }),
  },
}
```

The child list stays disabled until the parent is chosen and clears itself when
the parent changes.

Then add a route in `App.tsx` and an entry in `console/nav.ts`. The nav entry is
what the route guard reads, so a screen and its sidebar link can never disagree
about who may enter.

---

## Roles and scope

Two independent things:

- **Capability** — *may this role do this at all?* `src/rbac/matrix.ts`, taken
  directly from Section 07 of the blueprint.
- **Scope** — *over which rows?* A Main Admin is global. An Event Team user is
  pinned to their assigned sub-group, and `useAuth().scope` is merged into every
  list query so they cannot even request rows outside it.

```tsx
const { can, scope, isGlobal } = useAuth();
if (can('teams', 'create')) { /* show the button */ }
```

> **This controls the interface, not the server.** A hidden menu item is not a
> permission. The same matrix must be enforced on every API action or a
> hand-crafted request walks straight past it.

---

## Business rules

The mock enforces all six constraints from Section 05, so the error paths are
exercised during development rather than discovered in production. **Your API
must enforce the same ones** — these are the real boundary:

1. A player holds at most one **active** allocation per event.
2. A team cannot exceed `maxPlayers`.
3. Team 1 and Team 2 must differ and share a sub-group.
4. Inactive master records cannot be selected for a new transaction.
5. Every privileged change carries a user, a timestamp and a context.
6. A team or official cannot be booked into two overlapping slots.

They live in `src/api/mock/adapter.ts` (`applyConstraints`, `validateAllocation`,
`validateSchedule`) — readable as a specification for the server side.

---

## Charts

`src/ui/charts.tsx`. The categorical palette is
`#C72D86, #2475B7, #A88500, #00A170` — three brand colours plus `solar-700`.

That set is **validated, not chosen by eye**: on the panel surface `#0C0A14` it
passes the lightness band (L 0.48–0.67), the chroma floor, colour-vision-
deficiency separation (worst adjacent pair ΔE 9.0), the normal-vision floor
(ΔE 15.7) and contrast (≥ 3:1). The brand yellow `#FFCB00` is *not* used in charts
because at L 0.86 it sits far outside the band on a near-black surface.

Assign hues in fixed order and never cycle them. A ninth series folds into
"Other" rather than getting a generated colour. Status colours
(`STATUS_COLORS`) are reserved and always ship with a glyph and a word, so
meaning never rests on colour alone.

---

## Accessibility

- Every input has a visible label; errors are identified **in text**, not by
  colour (WCAG 2.2, 3.3.1).
- Status is carried by a glyph **and** a word as well as a colour.
- Dialogs trap focus, restore it to the trigger on close, and close on Escape.
- Charts expose an `aria-label` describing their data; the bar chart also offers
  a "View as table" disclosure.
- Permission refusals are stated, never silently hidden.
- `prefers-reduced-motion` is honoured globally in `src/index.css` and by Framer
  Motion.

---

## Responsive behaviour

| Width | Console |
| --- | --- |
| ≥ 1024px | Persistent sidebar rail, full data tables |
| 640–1023px | Sidebar collapses to a drawer, tables scroll horizontally |
| < 640px | Tables become **one card per row** — a nine-column grid at phone width either clips or shrinks below a usable size |

---

## Testing

```bash
npm run dev                      # terminal 1
node scripts/check-runtime.mjs   # terminal 2
node scripts/check-runtime.mjs --shots ./shots   # …and save screenshots
SMOKE_BASE=http://localhost:5174 node scripts/check-runtime.mjs   # another port
```

75 checks. Drives a real Chrome through the landing page and its stadium (the
camera following the scroll, the chapter rail, smooth in-page links handing
focus to their section, tabs, the lightbox, the mobile menu, no horizontal
overflow from 320 to 2560px, reduced motion, phones deferring WebGL), an axe
accessibility scan of the landing in both themes, sign-in and the auth guard,
every console route and legacy redirect, a CRUD round trip, the allocation and
fixture business rules, role scoping, export scoping, a 390px layout pass, and
the team builder lab driven with a real mouse, the keyboard and touch.
It fails the run on any console error, failed request, HTTP 4xx/5xx or Vite
error overlay — so a React key warning breaks the build, not just a broken page.

The "Audit regressions" block pins the defects fixed on 2026-09-29 (see
[`docs/audit-2026-09-29.md`](./docs/audit-2026-09-29.md)); each of those checks
fails against the code as it was before the fix. The four checks after the
reduced-motion step pin defects found by the independent review the next day;
they follow the reviewer's reproduction steps but were not re-run against the
pre-fix code.

Two conventions worth knowing before you extend it:

- Assertions read `textContent`, not `innerText`. `innerText` is style-aware, so
  a label wearing `text-transform: uppercase` reads back as `MATCHES` and a naive
  substring check silently never matches.
- Clicks hit-test with `elementFromPoint` and then fire an in-page `.click()`.
  The hit test is the part that matters — it proves nothing is covering the
  control — while CDP mouse events proved unreliable here straight after a React
  re-render.

`scripts/import-check.mjs` verifies the three.js / R3F named imports resolve.

---

## Deploying behind ASP.NET

`npm run build` emits `dist/`. Copy it into the Web API project (commonly
`wwwroot/`). Because the SPA uses real paths rather than hashes, the server must
return `index.html` for any route it does not otherwise handle:

```xml
<system.webServer>
  <rewrite>
    <rules>
      <rule name="SPA fallback" stopProcessing="true">
        <match url=".*" />
        <conditions logicalGrouping="MatchAll">
          <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
          <add input="{REQUEST_URI}" pattern="^/(api|token)" negate="true" />
        </conditions>
        <action type="Rewrite" url="/index.html" />
      </rule>
    </rules>
  </rewrite>
</system.webServer>
```

Without it, refreshing on `/console/teams` returns a 404.

Serving the SPA from the same origin as the API is the simplest option — set
`VITE_API_BASE_URL=` (empty) and CORS stops being a consideration at all. For
development across origins, uncomment the proxy block in `vite.config.js`.

---

## Still open

Carried forward from the blueprint's CLARIFY items — decisions, not defects:

- **Umpires** are modelled as their own master (`UmpireMaster`) with a
  `ScheduleUmpireDetail` junction, since a fixture can carry more than one
  official. If officials are really part of `EventTeamMaster`, that collapses.
- **Match results** had no supplied model. `MatchResult` here is a proposal
  covering what standings need; confirm the points scheme and any tie-break.
- **Overs** is stored as overs per innings on the fixture and may be left empty
  for football. Confirm whether it should vary by sub-group instead.
- **Team capacity** is per team (`maxPlayers`), not a global constant.
- **Registration edits** — participants cannot amend a submitted entry; the event
  team does it. Confirm that is the intent.

---

## Two rules in the public portal that must not be broken

Both were real bugs that stopped the page scrolling entirely:

1. **No negative z-index anywhere.** `#root` and `<body>` establish no stacking
   context, so a negative layer paints *and hit-tests* behind them — every wheel
   event lands on `#root` and the page freezes. Backdrop is `z-0`, content `z-10`.
2. **The canvas must be `pointer-events: none` on both wrapper and canvas.** A
   child can re-enable pointer events even when its parent disables them, and R3F
   sets `pointerEvents: 'auto'` on its own container by default.

Related: pass canvas positioning through `style`, not `className`. R3F writes
inline styles onto that element, and inline styles beat classes — a Tailwind
`fixed` is silently overridden by its `position: relative`.

---

## The stadium

The landing page scrolls over a floodlit cricket ground built entirely in code
(`src/three/stadium/`) — no model files and no textures to download. Every
surface is unlit: floodlight pools on the grass are computed in the shader and
the stands' lighting is baked into vertex colours, so the scene carries no
real-time lights. It draws in 15 calls: roughly 140k triangles on a desktop and
48k on a phone.

- **The stands are the Colour League.** Eight sections, one per division, each
  in its own colour and with an arc proportional to that division's points in
  `STANDINGS` (`src/lib/site-data.js`). Seen from overhead on the Colour League
  chapter, the bowl is a pie chart of the table, and the leader's stand pulses.
- **The camera follows the story.** `choreography.ts` lists one shot per section,
  anchored to the section's `id`. The camera arrives at a shot when that section
  reaches 45% of the viewport, travels a spline between shots, and is damped on
  the spline parameter, so it never cuts through the stands. To add or retune a
  shot, edit `SHOTS`; keep low, inside-the-bowl shots flagged `interior` so
  portrait screens widen the lens instead of pulling back through a stand.
- **Colour follows the section.** Sections publish an accent (`useSectionAccent`)
  that tints the LED boards, the grass sweep and the sky glow.
- **It scales itself.** `StadiumCanvas.tsx` picks a profile from the device
  (`useGraphicsTier`): seat density, pixel-ratio range and a megapixel budget,
  so a 4K screen never pays native-resolution fill rate for a backdrop that sits
  dimmed behind the copy. drei's `PerformanceMonitor` then scales both up or
  down at runtime, aiming for a steady 60 fps.
- **No post-processing, on purpose.** Every glow is drawn in the scene
  (additive halos, light shafts, emissive lamps), which is cheaper for a
  backdrop that sits dimmed behind the copy. (A bloom pass once rendered black
  on an integrated GPU; the team builder later traced that to multisampling —
  with `multisampling={0}` the same passes render correctly.)
- **It loads last.** three.js is fetched once the browser is idle after first
  paint; on phones, once the visitor first touches or scrolls. Until the first
  frame, a CSS night stadium (`.stadium-standin`) stands in, and it stays for
  good where WebGL2 is unavailable or the chunk fails to load.
- **Reduced motion** turns off Lenis and every idle animation; the camera still
  follows the scroll, rendering only when the page moves.

Measured on an Intel UHD 730 (integrated) in Chrome: a steady 60 fps at
1440×900, 1920×1080 and 390×844; about 50 fps at 2560×1440, where compositing
the page's blurred glass panels costs as much as the scene. Lighthouse on the
production build: desktop 99 performance / 100 accessibility / 100 best
practices; mobile (simulated mid-range phone) 93 / 100 / 100. SEO scores 66
only because `index.html` carries `noindex` and `robots.txt` disallows
crawling — deliberate for an internal portal.

`vite.config.js` splits vendor code with a `manualChunks` **function**. The
object form also sweeps each package's dependencies into its chunk, which once
put `react-dom/client` and Vite's preload helper inside the three.js chunk — so
every page, the console included, preloaded the renderer. The team builder's
libraries (postprocessing, camera-controls, react-spring, use-gesture) get a
`lab-gl` chunk of their own, and drei is left to Rollup, so the stadium loads
only the drei helper it uses and none of the lab's code. `three-stdlib` is
pinned to its own small chunk too: left alone, Rollup swept it into `lab-gl` as
a dependency of the post-processing, and the console's 3D team page, which
needs one module of it, then downloaded the whole lab chunk.

---

## The team builder lab

`/lab/team-builder` is a front-end prototype of a spatial team builder: pick an
eleven by dragging glass player cards onto holographic formation nodes on a 3D
pitch. It has no backend and saves nothing — the squad is local data in
`src/lab/team-builder/data/squad.ts`. It is linked from nowhere; open the URL.

**Using it.** Drag a card onto a glowing node, or flick it toward one and let
go. A card near a node is drawn in and condenses into the round chip the node
then shows. Drag a chip onto another node to swap, or back onto the squad to
bench the player. Tap a card, then a node — or a node first, then a card. From
the keyboard: Enter on a card picks the player up and moves focus to the best
position, the arrow keys move between positions as they appear on screen,
Enter places, Delete benches, Escape cancels and hands focus back to the card
or chip the player came from. Every change is announced to screen readers,
repeats included. Orbit with a drag on the pitch, dolly with the wheel, and
double-click (or the recentre button) to reset the camera.

**How it is put together** (`src/lab/team-builder/`):

| File | Job |
| --- | --- |
| `TeamBuilderLab.tsx` | Page: layout (side rail from 1024 px, bottom strip below), panel insets for the camera, Escape |
| `store/builderStore.ts` | zustand: formation, lineup, selection, the flight in progress, announcements. Discrete state only |
| `store/spatialBridge.ts` | The DOM ↔ WebGL sync: camera, projected node positions, drag and ghost state, the impact ring buffer. Plain mutable objects, never React state, so a drag re-renders nothing at frame rate |
| `hooks/useSpatial.ts` | Raycasting: screen → pitch plane, hit volumes → slot, the magnetic pull, world → screen |
| `hooks/useCardDrag.ts` | `@use-gesture/react` bound to the controller, touch-scroll aware |
| `interaction/dragController.ts` | A drag's life outside React: pick up, per-frame magnet and morph, release (place, swap, bench, flick, cancel), flight, landing |
| `canvas/Pitch.tsx`, `shaders.ts` | One shader plane: dark-glass pitch, live grid, breathing zones, scan sweep, slot pads, drop ripples that bend the markings |
| `canvas/FormationNodes.tsx` | Eleven holograms animated with `@react-spring/three`: glide between formations, overshoot when targeted, collapse when filled |
| `canvas/DropFX.tsx` | GPU particle bursts and drifting dust, simulated in the vertex shader |
| `canvas/Effects.tsx` | `@react-three/postprocessing`: depth of field on the targeted node, bloom, chromatic aberration kicked by drops |
| `canvas/CameraRig.tsx` | drei `CameraControls`: frames the formation in the space the panels leave clear, leans toward the node in play |
| `canvas/Projector.tsx` | Each frame: project the nodes, move their DOM buttons, step the controller |
| `ui/*` | Glass roster and cards, HUD, the flying ghost card (Framer Motion springs, velocity tilt, card → chip morph), slot buttons, hint, live region |

**Performance.** Everything that moves per frame bypasses React. Quality is a
ladder, chosen per device and walked at runtime by drei's `PerformanceMonitor`:

| Tier | Passes | Starts on |
| --- | --- | --- |
| high | depth of field + bloom, then aberration + vignette + tone mapping merged into one pass | discrete GPUs, Apple silicon |
| medium | the same without depth of field (which alone costs as much as the rest) | integrated GPUs, touch devices |
| low | bloom + vignette + tone mapping in one pass | — |
| minimal | no composer; the renderer tone-maps | — |

The monitor lowers the pixel ratio first, then the tier; it never re-adds a
pass it shed. Measured on an Intel UHD 730 in Chrome at 1440×900: medium holds
60 fps; high runs about 35 (depth of field). At 2560×1440 that GPU settles on
minimal at 0.75× pixel ratio and holds 60 fps. The glass panels' backdrop blur is
the largest fixed cost after depth of field, which is why it is 12 px: above
that radius Chrome's blur cost jumps several-fold. `?quality=high|medium|low|minimal`
forces a tier and `?monitor=off` pins it, for profiling.

**Without WebGL** (or if the GPU is lost) the pitch is drawn flat, top-down, in
the same place (`ui/FlatPitch.tsx`); the position buttons pin to it and
dragging, tapping and the keyboard all work, with the magnet measured on screen
instead of on the grass.

**Limits.** Only Chrome was exercised (desktop, plus phone and tablet
viewports with touch emulation), not real handsets, Safari or Firefox. The
canvas reads the screen's pixel ratio once, when it mounts: dragging the window
to a screen with a different ratio keeps the old one until a reload. The lab's
few `.tb-*` styles live in the global stylesheet, so every page carries them
(about 1 KB gzipped); its JavaScript does not.

---

## Brand

The visual system is a small brand triad plus a supporting accent, defined in `tailwind.config.js`.

| Token | Value | Source |
| --- | --- | --- |
| Magenta | `#C72D86` | Brand primary |
| Blue | `#2475B7` | Brand secondary |
| Yellow | `#FFCB00` | Brand highlight |
| Emerald Green | `#00A170` | Supporting accent |
| Typeface | DM Sans | Google Fonts |

Colour *is* the subject matter: each competing division carries its own colour.

Public portal content lives in `src/lib/site-data.js` — adding an event to
`EVENTS` and a row to `SCHEDULE` makes it appear in the grid, the calendar, the
ticker and the hero countdown automatically. Changing `STANDINGS` reshapes the
stadium's stands to match.
