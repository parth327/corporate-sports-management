# API reference

Every HTTP endpoint the front end calls. Base path defaults to same-origin
(empty `VITE_API_BASE_URL`); every path below is relative to that base.

Source of truth: `src/api/endpoints.ts` (URLs), `src/api/index.ts` (the typed
client every screen actually calls), `src/api/mock/adapter.ts` (the reference
implementation of every business rule — the real backend must match it).

## Transport & authentication

Two authentication schemes are supported, chosen by `VITE_AUTH_STRATEGY`
(`src/api/authStrategy.ts`). Nothing else in the app reads the scheme
directly — every call goes through `src/api/http.ts`, which asks the active
strategy for headers and credentials.

### `bearer` (default) — OWIN `/token`, OAuth password grant

The default for an ASP.NET Web API 4.5 project scaffolded with Individual
User Accounts.

- **Login:** `POST /token`, body `application/x-www-form-urlencoded`:
  `grant_type=password&username={u}&password={p}`.
- **Response:** `{ access_token, expires_in, ... }` (snake_case, per OAuth
  convention — the client reads both `access_token`/`accessToken` and
  `expires_in`/`expiresIn`).
- **Every subsequent request** carries `Authorization: Bearer {token}`.
- **Credentials mode:** `same-origin` (no cookies sent).

### `cookie` — Forms authentication

- **Login:** `POST /api/account/login`, JSON body `{ userName, password }`.
- **Session:** an `HttpOnly` cookie the server sets; no token is stored
  client-side. `credentials: 'include'` is set on every request. The server
  must reply with `Access-Control-Allow-Credentials: true` and an **explicit**
  origin (a wildcard `*` is rejected by browsers once credentials are on).

### Error shape (`ApiError`)

`src/api/errors.ts` normalises **any** of the three shapes an ASP.NET Web API
can return into one consistent object:

```ts
class ApiError extends Error {
  status: number;                       // HTTP status code, or 0 if unreachable
  fieldErrors: Record<string, string>;  // field name -> message, for form.setError()
  raw: unknown;                         // the original response body
}
```

| Server shape | When |
|---|---|
| `{ error, error_description }` | OAuth `/token` failures (bad credentials) |
| `{ Message, ModelState: { "model.Name": ["required"] } }` | ASP.NET `ModelState` validation failures. Keys are re-cased to camelCase and the `model.` prefix stripped, so `"model.Name"` → field `name` |
| `{ Message, ExceptionMessage, StackTrace }` | A generic `HttpError` |

A `401` on any non-anonymous request triggers a global "sign the user out"
callback (`setUnauthorizedHandler`, wired up by `AuthProvider`) — the session
is cleared and the user is redirected to `/login`.

### Casing

If your ASP.NET controllers return PascalCase JSON (no
`CamelCasePropertyNamesContractResolver` configured), set
`VITE_NORMALISE_CASING=true` and every response is recursively re-cased to
camelCase before the app sees it.

---

## The generic resource client

Eighteen of the nineteen tables below are exposed through one shape,
`Resource<T>` (`src/api/index.ts`):

| Method | HTTP | Path | Notes |
|---|---|---|---|
| `.list(query?)` | `GET` | `{path}` | Returns `PagedResult<T>` — `{ items, total, page, pageSize }` |
| `.get(id)` | `GET` | `{path}/{id}` | |
| `.create(payload)` | `POST` | `{path}` | |
| `.update(id, payload)` | `PUT` | `{path}/{id}` | |
| `.deactivate(id)` | `DELETE` | `{path}/{id}` | **Soft delete** — flips `isActive` to `false`; the row is never removed |
| `.options(query?)` | `GET` | `{path}` | Convenience for `<select>` pickers: forces `isActive: true, pageSize: 500`, returns just the array |

**Common `ListQuery` parameters**, accepted by every `.list()`/`.options()`
call:

| Param | Type | Meaning |
|---|---|---|
| `page`, `pageSize` | `number` | 1-indexed pagination |
| `search` | `string` | Free-text search — which fields it matches is resource-specific (see `src/api/mock/db.ts::queryCollection` for the mock's field list per table) |
| `isActive` | `boolean \| null` | Filter by soft-delete state. Omit to get only active rows in most screens (the UI passes it explicitly where "show inactive too" is offered) |
| `sortBy`, `sortDir` | `string`, `'asc'\|'desc'` | |
| *(anything else)* | `unknown` | Free-form — e.g. `{ subGroupId: 3 }` — merged straight into the query string |

### Resource table

| Resource key (`api.*`) | Path | Backs table # |
|---|---|---|
| `groups` | `/api/groups` | 1 |
| `subGroups` | `/api/subgroups` | 2 |
| `players` | `/api/players` | 3 |
| `playerSubTypes` | `/api/playersubtypes` | 4 |
| `playerSubTypeDetails` | `/api/playersubtypedetails` | 5 |
| `ruleCards` | `/api/rulecards` | 6 |
| `eventTeam` | `/api/eventteam` | 7 |
| `teams` | `/api/teams` | 8 |
| `teamAllocations` | `/api/teamallocations` | 9 |
| `teamGroups` | `/api/teamgroups` | 10 |
| `schedules` | `/api/schedules` | 11 |
| `events` | `/api/events` | 12 |
| `seasons` | `/api/seasons` | 13 |
| `users` | `/api/users` | 14 |
| `rolePermissions` | `/api/rolepermissions` | 15 |
| `umpires` | `/api/umpires` | 16 |
| `matchResults` | `/api/matchresults` | 17 |
| `auditLogs` | `/api/auditlogs` | 18 |
| `teamGroupDetails` | `/api/teamgroupdetails` | 19 |

(Table 20, ScheduleUmpireDetail, has no direct resource client — it is
written implicitly through `schedules.create`/`.update`'s `umpireIds` field.)

Field-level shapes for every one of the above are in `data-model.md`.
Business-rule validation specific to a resource (capacity limits,
double-booking, uniqueness) is documented there too, under that table's
"Constraints enforced on write".

---

## Auth endpoints

| Action | Method & path | Auth | Notes |
|---|---|---|---|
| Login | `POST /token` (bearer) or `POST /api/account/login` (cookie) | Anonymous | See "Transport & authentication" above |
| Logout | `POST /api/account/logout` | Authenticated | Client clears local session even if this call fails |
| Current user | `GET /api/account/me` | Authenticated | Called as a fallback when the login response has no embedded `user` object (some OWIN `/token` configurations return only claims) |
| Forgot password | `POST /api/account/forgot-password` | Anonymous | Body `{ email }`. **Always reports success** — never confirms whether an address is registered, by design |
| Reset password | `POST /api/account/reset-password` | Anonymous | Body `{ token, newPassword }` |
| Change password | `POST /api/account/change-password` | Authenticated | Body `{ currentPassword, newPassword }` |
| Update profile | `PUT /api/account/profile` | Authenticated | Body `{ displayName, email }`. Returns the updated `AuthUser` |

`AuthUser` shape (returned by login, `/me`, and profile update):

```ts
{
  userId: number;
  userName: string;
  displayName: string;
  email: string;
  role: 'MainAdmin' | 'EventTeam' | 'Public';
  subGroupId: number | null;
  subGroupName: string | null;
}
```

---

## Public registration & review

| Action | Method & path | Auth | Notes |
|---|---|---|---|
| Register | `POST /api/players/register` | **Anonymous** | Public entry form (Form 1). Body is a `Partial<PlayerMaster>`. Server stamps `status: 'Pending'`, `isActive: true`, `registeredOn`, `eventId` (current event) |
| Review a registration | `POST /api/players/{id}/review` | Authenticated, capability `players:edit` | Body `{ decision: 'activate'\|'reject'\|'hold', reason?: string }`. Maps to `PlayerMaster.status` = `Active`/`Rejected`/`Hold` respectively |

---

## Dashboard & reporting

| Action | Method & path | Auth | Notes |
|---|---|---|---|
| Dashboard summary | `GET /api/dashboard/summary` | Authenticated, capability `dashboard:view` | Query = `DashboardFilters` (`eventId?`, `groupId?`, `subGroupId?`, `from?`, `to?`). An `EventTeam` user's query is always merged with their own `subGroupId` server-side — this is both the UX filter and the authorisation boundary |
| Export a report | `POST /api/reports/export` | Authenticated, capability `exports:view` | Body is `ExportRequest` (below). Response is a file blob, not JSON — the client sets `expectBlob: true` |

**`DashboardSummary` response shape:**

```ts
{
  players: number;
  teams: number;
  matches: number;
  activeUsers: number;
  registrationsBySubGroup: { label, value, subGroupId }[];
  scheduleStatus: { label, value }[];         // by ScheduleStatus
  registrationsOverTime: { label, value }[];  // 8 weekly buckets, cumulative
  teamFill: { label, allocated, capacity, teamId }[];
  upcoming: ScheduleMaster[];                 // next 5 Scheduled/Pending fixtures
}
```

**`ExportRequest` body shape:**

```ts
{
  reportType: 'playerMaster' | 'teamRoster' | 'teamGroups'
            | 'matchSchedule' | 'rules' | 'dashboardSnapshot';
  format: 'XLS' | 'PDF' | 'CSV';
  filters: DashboardFilters & { teamId?: number | null; status?: string | null };
}
```

Every export reads from the **same filtered dataset** the dashboard/list
screen it was launched from would show — this is deliberate (see Form 24 in
`forms.md`): a downloaded file whose numbers don't match the screen it came
from is the most common source of report mistrust.

---

## Roles & permissions

Three roles exist: `MainAdmin`, `EventTeam`, `Public`. `Public` is never
actually stored as a `UserAccount.role` value in practice — it exists in the
type system to describe an anonymous visitor's capability grant (create-only
on `players`, via the registration endpoint above; nothing else).

**The full grant matrix**, from `src/rbac/matrix.ts`:

| Capability | MainAdmin | EventTeam | Public |
|---|---|---|---|
| `dashboard` | view, create, edit, deactivate | view only | none |
| `groups` | full | view only | none |
| `players` | full | **view + edit only** (cannot create or deactivate) | **create only** |
| `teams` | full | full | none |
| `allocation` | full | full | none |
| `teamGroups` | full | full | none |
| `schedule` | full | full | none |
| `rules` | full | full | none |
| `exports` | full | **view only, scoped to own sub-group** | none |

**Scope**, independent of the capability grant above:

| Role | Scope |
|---|---|
| `MainAdmin` | Global — every list query runs unfiltered |
| `EventTeam` | `SubGroup` — every list query is transparently merged with `{ subGroupId: <the user's own> }` server-side |
| `Public` | None — no authenticated queries at all |

**This is enforced twice, independently, and must stay in sync:**

1. **Client-side** — `src/rbac/matrix.ts`'s `can()` function decides what
   buttons/menu items the interface renders. Editable at runtime through
   Form 13 (Role Permissions), which writes to the `rolepermissions` table.
2. **Server-side** — the real backend must enforce the identical matrix on
   every single API action, independently of what the client sent. A hidden
   button in the UI is not a permission; a hand-crafted request that skips
   the UI entirely must still be refused server-side.

---

## Summary — every endpoint in one table

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/token` or `/api/account/login` | Anonymous | Sign in |
| `POST` | `/api/account/logout` | Auth | Sign out |
| `GET` | `/api/account/me` | Auth | Current user fallback |
| `POST` | `/api/account/forgot-password` | Anonymous | Request reset link |
| `POST` | `/api/account/reset-password` | Anonymous | Consume reset token |
| `POST` | `/api/account/change-password` | Auth | Change own password |
| `PUT` | `/api/account/profile` | Auth | Update own display name/email |
| `POST` | `/api/players/register` | Anonymous | Public entry form |
| `POST` | `/api/players/{id}/review` | Auth | Activate/reject/hold a registration |
| `GET` | `/api/dashboard/summary` | Auth | KPI + chart data |
| `POST` | `/api/reports/export` | Auth | Download a report file |
| `GET/POST/PUT/DELETE` | `/api/groups[/{id}]` | Auth | GroupMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/subgroups[/{id}]` | Auth | SubGroupMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/players[/{id}]` | Auth | PlayerMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/playersubtypes[/{id}]` | Auth | PlayerSubTypeMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/playersubtypedetails[/{id}]` | Auth | PlayerSubTypeDetail CRUD |
| `GET/POST/PUT/DELETE` | `/api/rulecards[/{id}]` | Auth | RuleCard CRUD |
| `GET/POST/PUT/DELETE` | `/api/eventteam[/{id}]` | Auth | EventTeamMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/teams[/{id}]` | Auth | TeamMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/teamallocations[/{id}]` | Auth | TeamAllocation CRUD |
| `GET/POST/PUT/DELETE` | `/api/teamgroups[/{id}]` | Auth | TeamGroupMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/teamgroupdetails[/{id}]` | Auth | TeamGroupDetail CRUD |
| `GET/POST/PUT/DELETE` | `/api/schedules[/{id}]` | Auth | ScheduleMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/matchresults[/{id}]` | Auth | MatchResult CRUD |
| `GET/POST/PUT/DELETE` | `/api/events[/{id}]` | Auth | EventMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/seasons[/{id}]` | Auth | SeasonMaster CRUD |
| `GET/POST/PUT/DELETE` | `/api/users[/{id}]` | Auth | UserAccount CRUD |
| `GET/POST/PUT/DELETE` | `/api/rolepermissions[/{id}]` | Auth | RolePermission CRUD |
| `GET/POST/PUT/DELETE` | `/api/umpires[/{id}]` | Auth | UmpireMaster CRUD |
| `GET` | `/api/auditlogs` | Auth | Audit log (read-only in the UI) |
