# Forms reference

Every form and interactive screen in the product, numbered the way the
codebase's own source comments number them (search any file for `Form N` to
find the exact code). Field *types and API shapes* are in `data-model.md`;
this document covers what's specific to the **form**: which fields appear,
client-side validation, conditional behaviour, and what happens on submit.

Forms 6–15 (and 12, 14, 15) share one generic engine — `src/console/Crud.tsx`
— rather than being hand-written. That section is documented once, then each
of those forms is a short table of the *configuration* it passes in, not a
re-explanation of how the engine works.

---

## Form 1 — Public registration

**File:** `src/console/pages/Registration.tsx` · **Route:** `/register` ·
**Auth:** none (anonymous) · **Submits to:** `POST /api/players/register`

A three-step wizard. Step 2 is a conditional chain — nothing irrelevant is
ever rendered:

```
Interest ──if Sports/Cultural──▶ Sub-group ──if types exist──▶ Player type
                                              ──if details exist──▶ Sub-type detail
```

Choosing **None** skips the whole sport branch. Validation is per-step (you
cannot advance past a step with errors) and the final submit re-validates
every step regardless.

### Step 1 — Your details

| Field | Type | Required | Validation |
|---|---|---|---|
| Full name | text | ✓ | Non-empty, ≥ 3 characters |
| Mobile number | tel | ✓ | Matches `/^[+\d][\d\s-]{7,19}$/` |
| WhatsApp number | tel | | Same pattern, if provided |
| Email | email | ✓ | Matches `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` |
| Date of birth | date | | If given: age must be 14–90 |
| Gender | select (Male/Female/Other) | | |
| Employee code | text | | "If company staff" |
| Department | text | | |

### Step 2 — What you are entering

| Field | Type | Required | Shown when |
|---|---|---|---|
| Interest | chip group (Sports/Cultural/None) | ✓ | always |
| Sub-group | chip group | ✓ | Interest is Sports or Cultural |
| Player type | chip group | ✓ | the chosen sub-group has any PlayerSubTypeMaster rows |
| Sub-type detail | chip group | ✓ | the chosen player type has any PlayerSubTypeDetail rows |

A live "record preview" line shows the classification path being built, e.g.
`Sports › Cricket › Bowler › Spin`.

### Step 3 — Confirm

| Field | Type | Required |
|---|---|---|
| T-shirt size | select (XS–XXL) | |
| Emergency contact name | text | |
| Emergency contact number | tel | if given, same phone pattern as above |
| Medical notes | textarea | |
| "The details above are correct" | checkbox | ✓ — blocks submit until ticked |

A read-only summary (name, mobile, email, classification, department) is
shown above the checkbox.

**On submit:** `POST /api/players/register` with the full payload (empty
optional fields sent as `null`, not omitted). Server sets `status: 'Pending'`.
On success, shows a reference number (`#` + zero-padded `playerId`) and a
confirmation screen. A duplicate email is rejected with a field error the
form attaches to the email field — but since email lives on Step 1 and the
error can only be known after Step 3's submit, the form navigates back to
Step 1 automatically to show it.

---

## Forms 2–5 — Authentication

**File:** `src/console/pages/auth.tsx` · Shared visual shell (`AuthShell`)
with the logo and a static gradient wash.

### Form 2 — Sign in

**Route:** `/login` · **Submits to:** `POST /token` (bearer) or
`POST /api/account/login` (cookie), depending on `VITE_AUTH_STRATEGY`.

| Field | Type | Required |
|---|---|---|
| Username or email | text | ✓ |
| Password | password | ✓ |
| "Keep me signed in on this device" | checkbox (default checked) | |

On success: redirects to the location the user was trying to reach before
being bounced to `/login` (or `/console` if none), and shows a welcome toast.
Bad credentials attach a server field error to `userName`/`password`.

When running against the mock (`VITE_USE_MOCK_API=true`), a "Demo accounts"
panel appears below the form with one-click buttons that fill in `admin`,
`cricket`, or `football` plus the shared demo password.

### Form 3 — Forgot password

**Route:** `/forgot-password` · **Submits to:**
`POST /api/account/forgot-password`

One field: **Email or username** (required). On submit, always shows "Check
your inbox" — the server/mock never confirms whether the address is
registered, so the form cannot either (this is stated in the UI itself, not
just a code comment).

### Form 4 — Reset password

**Route:** `/reset-password?token=...` · **Submits to:**
`POST /api/account/reset-password`

If the URL has no `token` query param, the form isn't shown at all — a
"Link is incomplete" message appears instead, with a link back to Form 3.

| Field | Type | Required | Validation |
|---|---|---|---|
| New password | password | ✓ | ≥ 8 characters |
| Confirm new password | password | ✓ | Must equal "New password" |

On success: redirects to `/login`.

### Form 5 — Profile & change password

**Route:** `/console/profile` · **Auth:** any signed-in user · Two
independent cards/forms on one page.

**Profile details** — submits to `PUT /api/account/profile`:

| Field | Type | Required | Validation |
|---|---|---|---|
| Display name | text | ✓ | |
| Email | email | ✓ | Standard email pattern |

Below the form, a read-only summary shows Username, Role, and Scope
(sub-group name, or "All groups and sub-groups" for a Main Admin) — these are
set by the Main Administrator elsewhere (Form 12) and not editable here.

**Change password** — submits to `POST /api/account/change-password`:

| Field | Type | Required | Validation |
|---|---|---|---|
| Current password | password | ✓ | |
| New password | password | ✓ | ≥ 8 characters |
| Confirm new password | password | ✓ | Must equal "New password" |

A wrong current password attaches a server error to that field; the form is
cleared on success.

---

## The generic master-data engine (Forms 6, 7, 8, 9, 10, 11, 12, 14, 15)

**File:** `src/console/Crud.tsx`. Nine of the console's forms are
structurally identical — a filtered, paginated list; a create/edit dialog;
and a deactivate confirmation — so they're declared as **data** (a
`CrudScreen<T>` configuration) rather than written out nine times. Each is a
short entry below listing only what differs.

**Every one of these forms shares this behaviour:**

- **List** — search box (debounced), an active/inactive/all filter, sortable
  columns, pagination.
- **Create/Edit dialog** — a two-column responsive grid of fields
  (`span: 2` fields take the full width). Built on `react-hook-form`.
  Foreign-key fields render as a `<select>` populated from another resource's
  `.options()` call (`CrudFieldSource` — supports `dependsOn` so, e.g.,
  choosing a parent clears/reloads a dependent field).
- **Deactivate** — a confirm dialog; always a soft delete (`DELETE` →
  `isActive: false`), never a hard delete, and the dialog says so.
- **Scope pinning** — when a form declares a `scopeField` (typically
  `subGroupId`) and the signed-in user is an `EventTeam` account, that field
  is force-set to the user's own sub-group and the control is disabled/locked
  with an explanatory hint, rather than merely defaulted.
- **Field types available:** `text`, `email`, `tel`, `password`, `number`,
  `textarea`, `date`, `time`, `select`, `checkbox`. A field can be marked
  `only: 'create'` or `only: 'edit'` to appear in just one mode (used for the
  initial-password field on Form 12).

### Form 6 — Groups

**Page:** `GroupsPage` in `src/console/pages/masters.tsx` · Table: GroupMaster (#1)

| Field | Type | Required |
|---|---|---|
| Group name | text (max 80) | ✓ |
| Display order | number (min 1) | ✓ |
| Description | textarea (max 400) | |
| Active | checkbox | |

### Form 7 — Sub-groups

**Page:** `SubGroupsPage` · Table: SubGroupMaster (#2)

| Field | Type | Required |
|---|---|---|
| Parent group | select (from Groups) | ✓ |
| Sub-group name | text (max 80) | ✓ |
| Display order | number | ✓ |
| Description | textarea (max 400) | |
| Active | checkbox | |

### Form 8 — Player types

**Page:** `PlayerTypesPage` · Table: PlayerSubTypeMaster (#4) · `scopeField: subGroupId`

| Field | Type | Required |
|---|---|---|
| Sub-group | select (from Sub-groups) | ✓ |
| Type name | text (max 60) | ✓ |
| Display order | number | ✓ |
| Active | checkbox | |

### Form 9 — Sub-type details

**Page:** `PlayerTypeDetailsPage` · Table: PlayerSubTypeDetail (#5)

| Field | Type | Required |
|---|---|---|
| Player type | select (from Player types) | ✓ |
| Detail name | text (max 60) | ✓ |
| Display order | number | ✓ |
| Active | checkbox | |

### Form 10 — Rule cards

**Page:** `RulesPage` · Table: RuleCard (#6) · `scopeField: subGroupId` ·
dialog size `lg`

| Field | Type | Required |
|---|---|---|
| Sub-group | select | ✓ |
| Rule title | text (max 140) | ✓ |
| Version | text (max 20) | ✓ |
| Effective from | date | ✓ |
| Rule body | textarea (max 6000), full width | ✓ |
| Active | checkbox | |

### Form 11 — Events & seasons

**Page:** `EventsPage` · Table: EventMaster (#12)

| Field | Type | Required |
|---|---|---|
| Event name | text (max 140), full width | ✓ |
| Season | select (from Seasons) | ✓ |
| This is the current event | checkbox | |
| Start date | date | ✓ |
| End date | date | ✓ |
| Active | checkbox | |

"This is the current event" is what new player registrations get stamped
with (`PlayerMaster.eventId`).

### Form 12 — User accounts

**Page:** `UsersPage` · Table: UserAccount (#14) · Main Admin only

| Field | Type | Required | Notes |
|---|---|---|---|
| Display name | text (max 120) | ✓ | |
| Username | text (max 60) | ✓ | Used to sign in |
| Email | email, full width | ✓ | |
| Initial password | password | ✓ | **`only: 'create'`** — never shown or editable on an existing account |
| Role | select (Main Admin / Event Team) | ✓ | |
| Assigned sub-group | select (from Sub-groups) | | "Required for Event Team accounts; leave empty for Main Admin" |
| Account active | checkbox, full width | | A deactivated account cannot sign in |

### Form 13 — Role permissions

**Page:** `PermissionsPage` in `src/console/pages/admin.tsx` · Table:
RolePermission (#15) · Main Admin only · **Hand-written, not the generic
engine** — this one's structure (a toggle grid) doesn't fit a field list.

One card per role, each containing a `Capability × Action` grid (9
capabilities × 4 actions = 36 toggle switches per role). Clicking a switch:

- Toggling **View** off also turns off Create/Edit/Deactivate for that
  capability (you cannot edit what you cannot see).
- Toggling any of Create/Edit/Deactivate **on** implies View on.

Each role has its own **Save** button — changes are staged locally
(`structuredClone`d per role) until saved, so switching between roles' grids
doesn't lose unsaved edits to another. A permanent warning banner on the page
states this only changes what the *interface offers*, not what the server
allows.

### Form 14 — Umpires & officials

**Page:** `UmpiresPage` · Table: UmpireMaster (#16)

| Field | Type | Required |
|---|---|---|
| Official name | text (max 120) | ✓ |
| Contact number | tel | ✓ |
| Email | email | |
| Accreditation / level | text (max 80) | |
| Sub-group availability | select | leave empty = available to all |
| Active | checkbox | |

### Form 15 — Event team

**Page:** `EventTeamPage` · Table: EventTeamMaster (#7) · `scopeField: subGroupId`

| Field | Type | Required |
|---|---|---|
| Member name | text (max 120) | ✓ |
| Role | select (Moderator / Co-Moderator / Timekeeper / Member) | ✓ |
| Contact number | tel | ✓ |
| Email | email | |
| Sub-group | select | ✓ |
| Event | select (from Events) | ✓ |
| Active | checkbox | |

---

## Form 16 — Players (register)

**Page:** `PlayersPage` in `src/console/pages/players.tsx` · Table:
PlayerMaster (#3) · `scopeField: subGroupId` · dialog size `lg` · uses the
generic engine, but with a much larger field list and a custom "View card"
row action (opens the animated player badge, `src/console/PlayerBadge.tsx`).

| Field | Type | Required | Notes |
|---|---|---|---|
| Full name | text (max 120), full width | ✓ | |
| Mobile number | tel | ✓ | |
| WhatsApp number | tel | | |
| Email | email, full width | ✓ | |
| Interest | select (Sports/Cultural/None) | ✓ | |
| Sub-group | select, depends on Interest | | |
| Player type | select, depends on Sub-group | | |
| Sub-type detail | select, depends on Player type | | |
| Review status | select (Pending/Active/Rejected/Hold) | ✓ | |
| Event | select | ✓ | |
| Date of birth | date | | |
| Gender | select (Male/Female/Other) | | |
| Employee code | text (max 30) | | |
| Department | text (max 80) | | |
| T-shirt size | select | | |
| Emergency contact | text (max 120) | | |
| Emergency number | tel | | |
| Medical notes | textarea (max 1000), full width | | |
| Record active | checkbox, full width | | |

The list's search covers name, email and mobile. Row actions: **View card**
(read-only), **Edit**, **Deactivate**/**Reactivate**.

---

## Form 17 — Review queue

**Page:** `PlayerReviewPage` in `src/console/pages/players.tsx` · Route:
`/console/players/review` · Submits to `POST /api/players/{id}/review` ·
**Hand-written**, not the generic engine.

A list of every `Pending` player (scoped to the reviewer's sub-group),
oldest-first, each opening a review dialog on click.

**The review dialog shows**, read-only: an animated player badge (sport
inferred from the applicant's sub-group), name, email, mobile, WhatsApp,
employee code, department, date of birth (+ computed age), T-shirt size,
full classification path, emergency contact, and medical notes if present.

**The decision itself:**

| Field | Type | Required |
|---|---|---|
| Decision | one of three cards: Activate / Hold / Reject | ✓ |
| Reason / note | textarea | required unless Decision is Activate |

The reason is recorded in the audit log regardless of decision (optional
text is still logged if given, even on Activate).

**On submit:** posts `{ decision, reason }`. Server maps the decision to
`PlayerMaster.status` (`Active`/`Hold`/`Rejected`) — see api-reference.md.

---

## Form 18 — Teams

**Page:** `TeamsPage` in `src/console/pages/competition.tsx` · Table:
TeamMaster (#8) · `scopeField: subGroupId` · generic engine, with a custom
**"Squad →"** row action linking straight into Form 19 for that team
(`/console/allocation?team={id}`).

| Field | Type | Required |
|---|---|---|
| Sub-group | select | ✓ |
| Event | select | ✓ |
| Team name | text (max 80) | ✓ |
| Short code | text (max 5) | ✓ — shown on the fixture grid |
| Maximum players | number (1–40, default 12) | ✓ — the capacity ceiling Form 19 enforces |
| Team colour | text, hex (max 7) | placeholder `#C72D86` |
| Active | checkbox | |

---

## Form 19 — Team allocation

**Page:** `AllocationPage` in `src/console/pages/Allocation.tsx` · Route:
`/console/allocation?team={id}` · Table written: TeamAllocation (#9) ·
**Hand-written** — this is the most interactive screen in the console, not a
field-and-dialog form at all.

Two panels, once a team is chosen from the dropdown (or arrives via the URL
query param):

- **Left — Eligible players.** Every `Active`-status player in the team's
  sub-group who does **not** already hold an active allocation anywhere this
  event. Searchable by name/email/department.
- **Right — Squad.** The team's current roster, numbered by `sortOrder` (or
  `allocationId` as a fallback for legacy rows with no explicit order).

**Interactions, each with a keyboard-accessible button equivalent (WCAG
2.5.7):**

| Action | How | What it does |
|---|---|---|
| Allocate | Drag a player onto the "drop here to add" zone, or click **Add →** | `POST /api/teamallocations` |
| Swap | Drag an eligible player onto an *occupied* numbered slot | The occupant is released (`DELETE`) and the dragged-in player is created in their place at the same `sortOrder`. If the create fails, the release is undone, so a refused swap never leaves the squad a player short |
| Reorder | Drag a squad row to a different position, or use the ↑/↓ buttons on each row | Re-numbers `sortOrder` for every row whose position actually changed; writes only those |
| Release | Drag a squad member back onto the eligible panel, or click **Release** | Confirmed via dialog, then `DELETE` (soft) |
| View a player | Click their name anywhere | Opens the read-only player badge card |

The squad panel also shows a live capacity meter (`filled / maxPlayers`) and
refuses new allocations once full — the UI disables the affected controls,
but the authority is the server-side capacity check (data-model.md, table
#9).

---

## Forms 20 & 21 — Team groups & membership

**Page:** `TeamGroupsPage` (+ its `GroupMembershipDialog`) in
`src/console/pages/competition.tsx` · Tables: TeamGroupMaster (#10) +
TeamGroupDetail (#19)

**Form 20 (the group itself)** uses the generic engine:

| Field | Type | Required |
|---|---|---|
| Sub-group | select | ✓ |
| Event | select | ✓ |
| Group name | text (max 60), full width | ✓ — e.g. "Group A" |
| Active | checkbox | |

**Form 21 (membership)** is a custom dialog opened by a **"Manage teams"** row
action, not the generic create/edit dialog — because "add a TeamGroupDetail
row" is not how anyone thinks about the task; "put these four teams in Group
A" is.

It lists every active team in the group's sub-group as a checkable row. On
**Save membership**, the dialog diffs the current selection against what was
already saved: teams newly checked are `POST`ed as new TeamGroupDetail rows;
teams newly unchecked are `DELETE`d (soft). Unchanged teams cause no request
at all.

---

## Form 22 — Match schedule (fixtures)

**Page:** `SchedulePage` in `src/console/pages/Schedule.tsx` · Table:
ScheduleMaster (#11) · **Hand-written**, not the generic engine — a fixture
is the one record with cross-field rules the declarative field list can't
express.

| Field | Type | Required | Notes |
|---|---|---|---|
| Match number | text | ✓ | e.g. "M-001" |
| Sub-group | select | ✓ | Locked to the user's own sub-group for Event Team accounts. Changing it clears both team fields and the officials list |
| Date | date | ✓ | |
| Time | time | ✓ | |
| Team 1 | select, populated once a sub-group is chosen | ✓ | |
| Team 2 | select, same list | ✓ | Client-side check: cannot equal Team 1 ("A team cannot play itself") |
| Overs per innings | number (1–50) | | Leave empty for football |
| Venue | text | | |
| Status | select (Scheduled/Completed/Pending/Cancelled) | ✓ | |
| Event | select, defaults to the event flagged `isCurrent` | ✓ | |
| Officials | multi-select chips, filtered to officials available to this sub-group (or unscoped) | | |

**Server-side rules the form surfaces field errors from** (see
data-model.md, table #11): both teams must be active and share the chosen
sub-group; no double-booking of either team or any selected official in the
same date+time slot.

List actions: **Edit**, **Cancel** (soft delete, frees the slot).

---

## Form 23 — Match results

**Page:** `ResultsPage` in `src/console/pages/Results.tsx` · Table:
MatchResult (#17) · **Hand-written.**

The list shows every active fixture with its score (if entered) and outcome
badge (Awaiting / Win / Tie / No result). Clicking a row opens the score
dialog.

| Field | Type | Required | Notes |
|---|---|---|---|
| Team 1 runs | number | ✓ | Card labelled with the actual team name |
| Team 1 wickets | number (0–10) | | |
| Team 1 points | number | ✓ | Defaults to 2 for a fresh entry |
| Team 2 runs | number | ✓ | |
| Team 2 wickets | number (0–10) | | |
| Team 2 points | number | ✓ | Defaults to 0 |
| Overs bowled | number (0–50) | | Pre-filled from the fixture's `oversPerInnings` |
| Outcome | select (Win / Tie / No result) | ✓ | "Winner is derived from the scores" — see below |
| Remarks | textarea, full width | | |

**The winner is computed, not chosen** — the form derives it live from the
two score fields (equal scores → Tie; higher score wins by the difference,
shown as "{team} by {n}") and displays the derived result inline before
submit, specifically so an operator cannot contradict the numbers they just
entered.

**On save:** writes the MatchResult row, then issues a second request
setting the parent fixture's `status` to `Completed` — stated on the form
itself ("Saving a result also marks the fixture Completed").

---

## Form 24 — Exports & dashboard filters

**Page:** `ReportsPage` in `src/console/pages/Reports.tsx` · Route:
`/console/reports` · Submits to `POST /api/reports/export`

Not a data-entry form — a filter + action grid. One filter row (Sub-group,
Main Admin only; Team, populated once a sub-group is known) applies to every
report below it, and is the same filter shape the Dashboard screen uses —
deliberately, so an exported file's numbers always reconcile with what the
screen showed when it was requested.

Six report types, each offering up to three format buttons:

| Report | Formats |
|---|---|
| Player master | XLS, PDF, CSV |
| Team roster | XLS, PDF, CSV |
| Team groups | XLS, PDF, CSV |
| Match schedule | XLS, PDF, CSV |
| Rule cards | PDF, XLS, CSV |
| Dashboard snapshot | PDF only |

Clicking a format button downloads that report immediately — there's no
intermediate confirmation step. See api-reference.md for the exact request
shape (`ExportRequest`).

---

## Not form-numbered, but worth documenting: the Dashboard

**Page:** `DashboardPage` in `src/console/pages/Dashboard.tsx` · Route:
`/console` · Not a form (nothing is submitted), but it has one live control:
a **Sub-group** filter (Main Admin only — an Event Team user's view is always
pre-filtered to their own sub-group server-side). Changing it re-fetches
`GET /api/dashboard/summary` with the new `subGroupId`.

Renders: four KPI tiles (Players, Teams, Matches, Active users — each a link
into the relevant screen), a registrations-by-sub-group bar chart, a
schedule-status donut, an 8-week registrations line chart, a team-fill meter
set, and an "up next" list of the five nearest fixtures.
