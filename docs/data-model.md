# Data model

Every table in the system, in the numbering used by the original blueprint
(preserved in the source comments of `src/api/types.ts`). All 20 tables plus
the shared `Auditable` contract every one of them extends.

Source of truth: `src/api/types.ts`. If this document and that file ever
disagree, the file is right — re-generate this section from it.

## Conventions used below

- **Type** is the TypeScript type. `?` after a field name means the field is
  optional in the object; `| null` means the API may explicitly return `null`
  for it.
- **PK** = primary key. **FK →** = foreign key, pointing at the table it
  references.
- Every table's JSON is camelCase. If your ASP.NET controllers return
  PascalCase instead, either add `CamelCasePropertyNamesContractResolver` to
  `WebApiConfig.cs`, or set `VITE_NORMALISE_CASING=true` and the front end
  will re-case every response for you (see `src/api/http.ts`).

## Shared: `Auditable`

Every table below extends this. It is never spelled out again per-table.

| Field | Type | Notes |
|---|---|---|
| `isActive` | `boolean` | The soft-delete flag. `false` means "deleted" — the row is never removed. |
| `createdBy` | `string?` | Username of the creator. |
| `createdOn` | `string?` | ISO 8601 timestamp. |
| `modifiedBy` | `string?` | Username of the last editor. |
| `modifiedOn` | `string?` | ISO 8601 timestamp. |

---

## 1. GroupMaster — `groups`

The top-level activity classification. Currently seeded with three rows:
Sports, Cultural, None.

| Field | Type | Notes |
|---|---|---|
| `groupId` | `number` | PK |
| `groupName` | `string` | e.g. "Sports" |
| `description` | `string?` | |
| `displayOrder` | `number` | Controls the order shown on public registration |

**Referenced by:** SubGroupMaster.groupId

---

## 2. SubGroupMaster — `subgroups`

Cricket / Football under Sports; Cultural-1 / Cultural-2 under Cultural. **This is the
unit an Event Team user's access is scoped to** — every `EventTeam` account
carries exactly one `subGroupId`, and the whole RBAC scope filter (see
`api-reference.md`) pins every list query to it.

| Field | Type | Notes |
|---|---|---|
| `subGroupId` | `number` | PK |
| `groupId` | `number` | FK → GroupMaster |
| `subGroupName` | `string` | e.g. "Cricket" |
| `description` | `string?` | |
| `displayOrder` | `number` | |
| `groupName` | `string?` | Denormalised for list views; server may omit, client re-derives via lookup |

**Referenced by:** PlayerMaster, PlayerSubTypeMaster, RuleCard, EventTeamMaster,
TeamMaster, TeamGroupMaster, ScheduleMaster, UmpireMaster (optional), UserAccount
(EventTeam accounts).

**Constraint enforced on write:** `groupId` must reference an active
GroupMaster row (see api-reference.md → Business rules).

---

## 3. PlayerMaster — `players`

The participant record. Most rows arrive through public registration (Form 1);
a Main Admin can also add one directly (Form 16). This is the single largest
table in the seed data (290 rows across the four sub-groups plus 6 "None"
registrations).

| Field | Type | Notes |
|---|---|---|
| `playerId` | `number` | PK |
| `name` | `string` | |
| `mobileNo` | `string` | |
| `whatsAppNo` | `string?` | |
| `email` | `string` | Must be unique — see constraint below |
| `interest` | `'Sports' \| 'Cultural' \| 'None'` | |
| `subGroupId` | `number? \| null` | FK → SubGroupMaster. Null when `interest` is `'None'` |
| `playerSubTypeId` | `number? \| null` | FK → PlayerSubTypeMaster |
| `playerSubTypeDetailId` | `number? \| null` | FK → PlayerSubTypeDetail |
| `eventId` | `number? \| null` | FK → EventMaster. Stamped with the current event on registration |
| `status` | `'Pending' \| 'Active' \| 'Rejected' \| 'Hold'` | New registrations start `Pending` |
| `dateOfBirth` | `string? \| null` | ISO date |
| `gender` | `'Male' \| 'Female' \| 'Other' \| null` | |
| `employeeCode` | `string? \| null` | If company staff |
| `department` | `string? \| null` | |
| `emergencyContactName` | `string? \| null` | |
| `emergencyContactNo` | `string? \| null` | |
| `tShirtSize` | `'XS'\|'S'\|'M'\|'L'\|'XL'\|'XXL' \| null` | |
| `medicalNotes` | `string? \| null` | Allergies etc. — shown to reviewers only |
| `photoUrl` | `string? \| null` | Not currently populated by any form |
| `registeredOn` | `string?` | Date, set on create |
| `subGroupName`, `playerSubTypeName`, `playerSubTypeDetailName` | `string?` | Denormalised display helpers |

**Constraint enforced on write:** a duplicate `email` (case-insensitive) is
rejected with HTTP 409 and a field error on `email` — this is what Form 1's
"That email address is already registered" message comes from.

**Referenced by:** TeamAllocation.playerId (at most one *active* allocation
per player per event — see TeamAllocation below).

---

## 4. PlayerSubTypeMaster — `playersubtypes`

Batsman / Bowler / Wicket-keeper / Other support for Cricket; the equivalent
positions for Football. Drives the second conditional branch on public
registration.

| Field | Type | Notes |
|---|---|---|
| `playerSubTypeId` | `number` | PK |
| `subGroupId` | `number` | FK → SubGroupMaster |
| `subTypeName` | `string` | |
| `displayOrder` | `number` | |
| `subGroupName` | `string?` | Denormalised |

**Constraint enforced on write:** `subGroupId` must reference an active
SubGroupMaster row.

---

## 5. PlayerSubTypeDetail — `playersubtypedetails`

Third level of classification — Spin / Pace / Medium under Bowler. Shown on
registration only when the chosen player type has details configured (some
don't, e.g. Batsman → Opener/Middle order/Finisher does, but Wicket-keeper has
none in the seed).

| Field | Type | Notes |
|---|---|---|
| `playerSubTypeDetailId` | `number` | PK |
| `playerSubTypeId` | `number` | FK → PlayerSubTypeMaster |
| `detailName` | `string` | |
| `displayOrder` | `number` | |
| `playerSubTypeName` | `string?` | Denormalised |

**Constraint enforced on write:** `playerSubTypeId` must reference an active
PlayerSubTypeMaster row.

---

## 6. RuleCard — `rulecards`

Playing conditions published per sub-group. Versioned and dated so a
mid-season amendment never silently rewrites what was played under.

| Field | Type | Notes |
|---|---|---|
| `ruleId` | `number` | PK |
| `subGroupId` | `number` | FK → SubGroupMaster |
| `ruleTitle` | `string` | |
| `ruleBody` | `string` | Free text, one clause per line by convention |
| `effectiveDate` | `string` | ISO date |
| `version` | `string` | e.g. "v1.2" |
| `subGroupName` | `string?` | Denormalised |

---

## 7. EventTeamMaster — `eventteam`

Moderators, co-moderators, timekeepers and members, recorded per **event**
(not per season generally — per the specific yearly event row) so the yearly
rotation is history rather than an overwrite.

| Field | Type | Notes |
|---|---|---|
| `eventTeamId` | `number` | PK |
| `memberName` | `string` | |
| `contactNo` | `string` | |
| `email` | `string?` | |
| `role` | `'Moderator' \| 'CoModerator' \| 'Timekeeper' \| 'Member'` | |
| `subGroupId` | `number` | FK → SubGroupMaster |
| `eventId` | `number` | FK → EventMaster |
| `subGroupName` | `string?` | Denormalised |

---

## 8. TeamMaster — `teams`

A team within one sub-group, with a hard capacity ceiling.

| Field | Type | Notes |
|---|---|---|
| `teamId` | `number` | PK |
| `subGroupId` | `number` | FK → SubGroupMaster |
| `teamName` | `string` | |
| `teamCode` | `string` | Short code (≤5 chars), shown on the fixture grid |
| `maxPlayers` | `number` | The capacity ceiling — enforced at allocation time, not just displayed |
| `eventId` | `number` | FK → EventMaster |
| `captainPlayerId` | `number? \| null` | FK → PlayerMaster. Auto-assigned to the first player allocated (mock behaviour) |
| `colorHex` | `string? \| null` | Used for the fixture grid and the player badge's jersey tint |
| `subGroupName` | `string?` | Denormalised |
| `allocatedCount` | `number?` | **Server-computed**, not stored — count of active TeamAllocation rows for this team |

**Constraint enforced on write:** `subGroupId` must reference an active
SubGroupMaster row.

---

## 9. TeamAllocation — `teamallocations`

Player → team. The junction table the whole "Team allocation" screen (Form
19) is built around.

| Field | Type | Notes |
|---|---|---|
| `allocationId` | `number` | PK |
| `playerId` | `number` | FK → PlayerMaster |
| `teamId` | `number` | FK → TeamMaster |
| `eventId` | `number` | FK → EventMaster |
| `allocationDate` | `string` | ISO date |
| `jerseyNo` | `number? \| null` | |
| `remarks` | `string? \| null` | |
| `sortOrder` | `number? \| null` | Squad position (the serial number shown on the allocation screen). Null on rows created before reordering existed — the UI falls back to `allocationId` for a stable order |
| `playerName`, `teamName` | `string?` | Denormalised |

**Constraints enforced on write (the most heavily validated table in the
system):**

1. **One active allocation per player per event.** A player already holding
   an active allocation this event is refused (HTTP 409) with a field error
   on `playerId`.
2. **Capacity ceiling.** A team already at `maxPlayers` active allocations is
   refused (HTTP 409) with a field error on `teamId`.
3. **Player must be `Active` status.** A `Pending`, `Hold` or `Rejected`
   player cannot be allocated (HTTP 400, field error on `playerId`).
4. **Player and team must share a `subGroupId`.** Cross-sub-group allocation
   is refused (HTTP 400, field error on `teamId`).
5. Both `playerId` and `teamId` must reference active rows.

**Soft-delete note:** releasing a player (`DELETE`) flips `isActive` to
`false` rather than removing the row — the roster history ("who played where,
and when") is preserved. See Form 19 in `forms.md` for the swap/reorder UI
built on top of this.

---

## 10. TeamGroupMaster — `teamgroups`

Group A / Group B and so on, inside a sub-group.

| Field | Type | Notes |
|---|---|---|
| `teamGroupId` | `number` | PK |
| `subGroupId` | `number` | FK → SubGroupMaster |
| `groupName` | `string` | e.g. "Group A" |
| `eventId` | `number` | FK → EventMaster |
| `subGroupName` | `string?` | Denormalised |
| `teamCount` | `number?` | **Server-computed** — active TeamGroupDetail rows for this group |

---

## 11. ScheduleMaster — `schedules`

A fixture.

| Field | Type | Notes |
|---|---|---|
| `scheduleId` | `number` | PK |
| `matchNo` | `string` | e.g. "M-001" |
| `matchDate` | `string` | ISO date |
| `matchTime` | `string` | `HH:mm` |
| `team1Id` | `number` | FK → TeamMaster |
| `team2Id` | `number` | FK → TeamMaster |
| `subGroupId` | `number` | FK → SubGroupMaster |
| `eventId` | `number` | FK → EventMaster |
| `oversPerInnings` | `number? \| null` | Cricket only; null for football |
| `venue` | `string? \| null` | |
| `status` | `'Scheduled' \| 'Completed' \| 'Pending' \| 'Cancelled'` | |
| `umpireIds` | `number[]?` | The assigned officials — see ScheduleUmpireDetail below |
| `team1Name`, `team2Name`, `subGroupName` | `string?` | Denormalised |

**Constraints enforced on write:**

1. Both teams must reference active TeamMaster rows.
2. `team1Id !== team2Id` — a team cannot play itself.
3. Both teams must share a `subGroupId`.
4. **No double-booking.** If either team is already fixtured at the same
   `matchDate` + `matchTime` in another active fixture, the save is refused
   (HTTP 409) with a field error on `matchTime`.
5. **No official double-booking.** If any of the requested `umpireIds` is
   already assigned to another fixture in the same slot, the save is refused
   (HTTP 409) with a field error on `umpireIds`.

---

## 12. EventMaster — `events`

The yearly isolation key. Every team, allocation, fixture and report is
stamped with an event, so one year's moderators and rosters never collide
with the next's.

| Field | Type | Notes |
|---|---|---|
| `eventId` | `number` | PK |
| `eventName` | `string` | |
| `seasonId` | `number` | FK → SeasonMaster |
| `startDate`, `endDate` | `string` | ISO dates |
| `isCurrent` | `boolean` | New registrations are stamped with whichever event has this set. Exactly one should be true at a time (not enforced by the mock — a UI/process convention) |
| `seasonName` | `string?` | Denormalised |

---

## 13. SeasonMaster — `seasons`

| Field | Type | Notes |
|---|---|---|
| `seasonId` | `number` | PK |
| `seasonName` | `string` | |
| `year` | `number` | |

---

## 14. UserAccount — `users`

Sign-in accounts. An `EventTeam` account **must** carry a `subGroupId` — that
assignment is what scopes everything the account can see (see
`api-reference.md` → "Roles & permissions").

| Field | Type | Notes |
|---|---|---|
| `userId` | `number` | PK |
| `userName` | `string` | Unique (case-insensitive) — used to sign in |
| `email` | `string` | |
| `displayName` | `string` | |
| `role` | `'MainAdmin' \| 'EventTeam' \| 'Public'` | `'Public'` is never actually stored — see api-reference.md |
| `subGroupId` | `number? \| null` | Required in practice for `EventTeam`; empty for `MainAdmin` |
| `lastLoginOn` | `string? \| null` | |
| `password` | `string?` | **Write-only.** Accepted on create; never returned by any read |
| `subGroupName` | `string?` | Denormalised |

**Constraint enforced on write:** `userName` must be unique, case-insensitive
(HTTP 409, field error on `userName`).

---

## 15. RolePermission — `rolepermissions`

The editable version of the RBAC matrix described in `src/rbac/matrix.ts`.
One row per role.

| Field | Type | Notes |
|---|---|---|
| `rolePermissionId` | `number` | PK |
| `roleName` | `string` | `'MainAdmin'` or `'EventTeam'` |
| `scopeType` | `'Global' \| 'SubGroup' \| 'Self'` | |
| `permissions` | `Record<Capability, CapabilityGrant>` | See below |

`Capability` is one of: `dashboard`, `groups`, `players`, `teams`,
`allocation`, `teamGroups`, `schedule`, `rules`, `exports`.

`CapabilityGrant` is `{ view: boolean; create: boolean; edit: boolean;
deactivate: boolean }`.

**Editing this table only changes what the *interface* offers** (Form 13 in
`forms.md` says so explicitly, in the UI itself). It has no effect on the
server's own authorisation — that must be enforced independently, or a
hand-crafted request bypasses it entirely.

---

## 16. UmpireMaster — `umpires`

The officials register.

| Field | Type | Notes |
|---|---|---|
| `umpireId` | `number` | PK |
| `umpireName` | `string` | |
| `contactNo` | `string` | |
| `email` | `string? \| null` | |
| `accreditationLevel` | `string?` | e.g. "Certified Level 2" |
| `subGroupId` | `number? \| null` | Null = available to every sub-group |
| `subGroupName` | `string?` | Denormalised |

---

## 17. MatchResult — `matchresults`

Scores and outcomes — the table standings, winner/loser and post-event
reporting all read from. One row per completed fixture.

| Field | Type | Notes |
|---|---|---|
| `matchResultId` | `number` | PK |
| `scheduleId` | `number` | FK → ScheduleMaster |
| `team1Score`, `team2Score` | `number` | |
| `team1Wickets`, `team2Wickets` | `number? \| null` | Cricket only |
| `oversBowled` | `number? \| null` | |
| `result` | `'Win' \| 'Loss' \| 'Tie' \| 'NoResult'` | |
| `winningTeamId` | `number? \| null` | FK → TeamMaster. Null for a tie or no-result |
| `margin` | `string? \| null` | Free text, e.g. "12 runs" |
| `pointsTeam1`, `pointsTeam2` | `number` | League points awarded |
| `manOfTheMatchPlayerId` | `number? \| null` | FK → PlayerMaster. Not currently set by any form |
| `remarks` | `string? \| null` | |
| `matchNo` | `string?` | Denormalised |

**Side effect on save:** saving a result also sets the parent
ScheduleMaster's `status` to `'Completed'` (a second request the client
issues, not a server-side cascade — see Form 23 in `forms.md`).

---

## 18. AuditLog — `auditlogs`

Read-only in the UI; written by the server (or, in the mock, by every
mutating call) on every privileged action.

| Field | Type | Notes |
|---|---|---|
| `auditId` | `number` | PK |
| `entityName` | `string` | e.g. `"PlayerMaster"` |
| `entityId` | `number` | |
| `action` | `'Create' \| 'Update' \| 'Deactivate' \| 'Activate' \| 'Login' \| 'Logout' \| 'Export'` | |
| `userName` | `string` | |
| `timestamp` | `string` | ISO 8601 |
| `details` | `string?` | Free text description |

Note: `AuditLog` does **not** extend `Auditable` — it has no `isActive` of
its own (an audit entry is never soft-deleted) and no created/modified pair
(it *is* the record of when something happened).

---

## 19. TeamGroupDetail — `teamgroupdetails`

The junction that stops "which teams are in Group A" from becoming a
comma-separated column on TeamGroupMaster. Presented in the UI as a
membership picker (Form 21), not as raw CRUD rows.

| Field | Type | Notes |
|---|---|---|
| `teamGroupDetailId` | `number` | PK |
| `teamGroupId` | `number` | FK → TeamGroupMaster |
| `teamId` | `number` | FK → TeamMaster |
| `teamName` | `string?` | Denormalised |
| `teamGroupName` | `string?` | Denormalised, formatted as `"{subGroupName} — {groupName}"` |

**Constraint enforced on write:** the same team cannot be added twice to the
same group while an active row already exists (HTTP 409, field error on
`teamId`).

---

## 20. ScheduleUmpireDetail — `scheduleumpires` *(implied junction)*

Not explicitly named in the original blueprint, but implied by the fact a
fixture can carry more than one official. The client never talks to this
table directly — writing `ScheduleMaster.umpireIds` on create/update causes
the server (in the mock, `syncScheduleUmpires`) to replace this fixture's
rows to match.

| Field | Type | Notes |
|---|---|---|
| `scheduleUmpireId` | `number` | PK |
| `scheduleId` | `number` | FK → ScheduleMaster |
| `umpireId` | `number` | FK → UmpireMaster |
| `umpireName` | `string?` | Denormalised |

---

## Non-table types (request/response shapes, not persisted entities)

These appear in `src/api/types.ts` alongside the tables above but are not
themselves rows in any store — they are the shapes of specific API
requests/responses. Documented in full under their endpoint in
`api-reference.md`.

| Type | Used by |
|---|---|
| `AuthUser` | Every auth response — the signed-in user's identity + role + scope |
| `LoginRequest` / `LoginResponse` | `POST /token` |
| `DashboardFilters` / `DashboardSummary` | `GET /api/dashboard/summary` |
| `ExportRequest` | `POST /api/reports/export` |
| `PagedResult<T>` | The envelope every list endpoint returns: `{ items, total, page, pageSize }` |
| `ListQuery` | The query parameters every list endpoint accepts: `page`, `pageSize`, `search`, `isActive`, `sortBy`, `sortDir`, plus free-form filters |
