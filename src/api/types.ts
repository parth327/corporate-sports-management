/**
 * Domain model for the Corporate Premier League.
 *
 * These interfaces are the contract between this front end and the ASP.NET Web
 * API. Property names are camelCase because Web API's default JSON formatter
 * (Json.NET with CamelCasePropertyNamesContractResolver) serialises C# PascalCase
 * that way. If your API returns PascalCase instead, either add the resolver in
 * WebApiConfig.cs:
 *
 *   config.Formatters.JsonFormatter.SerializerSettings.ContractResolver =
 *     new CamelCasePropertyNamesContractResolver();
 *
 * ...or turn on the key re-caser in `src/api/http.ts` (NORMALISE_CASING).
 *
 * Every table from Section 04 of the blueprint appears here, including the six
 * recommended support tables and the one junction the document implies but never
 * names (ScheduleUmpireDetail).
 */

/* ------------------------------------------------------------------ *
 * Shared primitives
 * ------------------------------------------------------------------ */

/** Every table in the blueprint soft-deletes rather than hard-deletes. */
export interface Auditable {
  isActive: boolean;
  createdBy?: string;
  createdOn?: string;
  modifiedBy?: string;
  modifiedOn?: string;
}

/** Envelope for paged list endpoints. */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean | null;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Free-form server-side filters, e.g. { subGroupId: 1 }. */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ *
 * Enumerations
 * ------------------------------------------------------------------ */

export const INTERESTS = ['Sports', 'Cultural', 'None'] as const;
export type Interest = (typeof INTERESTS)[number];

export const PLAYER_STATUSES = ['Pending', 'Active', 'Rejected', 'Hold'] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

/**
 * Four sign-in surfaces:
 *
 *   MainAdmin        masters, team formation rules, event scheduling, users,
 *                    role rights and the audit trail — global scope.
 *   ManagementTeam   classifies participants (group -> sub-group -> type -> detail)
 *                    and builds squads. Scoped to its own sub-group.
 *   EventManagement  runs events once they exist: match scheduling, rule cards
 *                    and results entry.
 *   Public           the marketing site only. Holds no console capability at
 *                    all now that self-registration is gone — participants arrive
 *                    from the HR API rather than signing themselves up.
 */
export const ROLES = ['MainAdmin', 'ManagementTeam', 'EventManagement', 'Public'] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_TEAM_ROLES = ['Moderator', 'CoModerator', 'Timekeeper', 'Member'] as const;
export type EventTeamRole = (typeof EVENT_TEAM_ROLES)[number];

export const MATCH_RESULTS = ['Win', 'Loss', 'Tie', 'NoResult'] as const;
export type MatchResultKind = (typeof MATCH_RESULTS)[number];

export const SCHEDULE_STATUSES = ['Scheduled', 'Completed', 'Pending', 'Cancelled'] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const EXPORT_FORMATS = ['XLS', 'PDF', 'CSV'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/* ------------------------------------------------------------------ *
 * 1-6  Master data (source-defined)
 * ------------------------------------------------------------------ */

/** 1. Sports / Cultural / None. */
export interface GroupMaster extends Auditable {
  groupId: number;
  groupName: string;
  description?: string;
  displayOrder: number;
}

/** 2. Cricket / Football under Sports; Cultural-1 / Cultural-2 under Cultural. */
export interface SubGroupMaster extends Auditable {
  subGroupId: number;
  groupId: number;
  subGroupName: string;
  description?: string;
  displayOrder: number;
  /** Denormalised for list views; the API may omit it. */
  groupName?: string;
}

/** 3. The participant record created by public registration. */
export interface PlayerMaster extends Auditable {
  playerId: number;
  name: string;
  mobileNo: string;
  whatsAppNo?: string;
  email: string;
  interest: Interest;
  subGroupId?: number | null;
  playerSubTypeId?: number | null;
  playerSubTypeDetailId?: number | null;
  eventId?: number | null;
  status: PlayerStatus;
  /* Recommended additions — see the User Guide, "Fields we added". */
  dateOfBirth?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | null;
  employeeCode?: string | null;
  department?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNo?: string | null;
  tShirtSize?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | null;
  medicalNotes?: string | null;
  photoUrl?: string | null;
  registeredOn?: string;
  /** Denormalised display helpers. */
  subGroupName?: string;
  playerSubTypeName?: string;
  playerSubTypeDetailName?: string;
}

/** 4. Batsman / Bowler / Wicket-keeper / Other support. */
export interface PlayerSubTypeMaster extends Auditable {
  playerSubTypeId: number;
  subGroupId: number;
  subTypeName: string;
  displayOrder: number;
  subGroupName?: string;
}

/** 5. Spin / Pace / Medium. */
export interface PlayerSubTypeDetail extends Auditable {
  playerSubTypeDetailId: number;
  playerSubTypeId: number;
  detailName: string;
  displayOrder: number;
  playerSubTypeName?: string;
}

/** 6. Rule cards, scoped per sub-group. */
export interface RuleCard extends Auditable {
  ruleId: number;
  subGroupId: number;
  ruleTitle: string;
  ruleBody: string;
  effectiveDate: string;
  version: string;
  subGroupName?: string;
}

/* ------------------------------------------------------------------ *
 * 7-11  Transactional data (source-defined)
 * ------------------------------------------------------------------ */

/** 7. Moderator / co-moderator / timekeeper / member, rotating by year. */
export interface EventTeamMaster extends Auditable {
  eventTeamId: number;
  memberName: string;
  contactNo: string;
  email?: string;
  role: EventTeamRole;
  subGroupId: number;
  eventId: number;
  subGroupName?: string;
}

/**
 * 8a. The shape a squad has to take.
 *
 * A formation is a template, not a team: "Standard Cricket XI" says a side
 * runs 11–15 people with at most 5 batsmen, 4 bowlers and 2 keepers, and
 * every cricket team in the sub-group is built against it. Keeping it
 * separate from TeamMaster is what lets the squad builder draw the right
 * empty slots before a single participant has been placed, and what stops the
 * same composition rules being retyped for each team.
 */
export interface TeamFormationSlot {
  playerSubTypeId: number;
  /** Ceiling for this type. The slots the builder draws. */
  max: number;
  /** Squad is short until this many are filled. 0 = no floor. */
  min: number;
  /** Denormalised for display; the API may omit it. */
  playerSubTypeName?: string;
}

export interface TeamFormation extends Auditable {
  formationId: number;
  subGroupId: number;
  formationCode: string;
  formationName: string;
  minPlayers: number;
  maxPlayers: number;
  slots: TeamFormationSlot[];
  subGroupName?: string;
  /** Server-computed: how many teams are built against this formation. */
  teamCount?: number;
}

/** 8. A team within one sub-group, with a capacity ceiling. */
export interface TeamMaster extends Auditable {
  teamId: number;
  subGroupId: number;
  teamName: string;
  teamCode: string;
  maxPlayers: number;
  eventId: number;
  captainPlayerId?: number | null;
  colorHex?: string | null;
  /** The formation this squad is built against. */
  formationId?: number | null;
  subGroupName?: string;
  formationName?: string;
  /** Server-computed convenience field for roster fill meters. */
  allocatedCount?: number;
}

/** 9. Player -> team. At most one active row per player per event. */
export interface TeamAllocation extends Auditable {
  allocationId: number;
  playerId: number;
  teamId: number;
  eventId: number;
  allocationDate: string;
  jerseyNo?: number | null;
  remarks?: string | null;
  /**
   * Squad position, as shown by the serial number on the allocation screen.
   * Nullable because rows created before the roster was ever reordered have
   * none; the UI falls back to allocationId so the order is still stable.
   */
  sortOrder?: number | null;
  playerName?: string;
  teamName?: string;
}

/** 10. Group A / Group B within a sub-group. */
export interface TeamGroupMaster extends Auditable {
  teamGroupId: number;
  subGroupId: number;
  groupName: string;
  eventId: number;
  subGroupName?: string;
  teamCount?: number;
}

/** 16. The junction that stops group membership becoming a CSV column. */
export interface TeamGroupDetail extends Auditable {
  teamGroupDetailId: number;
  teamGroupId: number;
  teamId: number;
  teamName?: string;
  teamGroupName?: string;
}

/** 11. A fixture. */
export interface ScheduleMaster extends Auditable {
  scheduleId: number;
  matchNo: string;
  matchDate: string;
  matchTime: string;
  team1Id: number;
  team2Id: number;
  subGroupId: number;
  eventId: number;
  oversPerInnings?: number | null;
  venue?: string | null;
  status: ScheduleStatus;
  umpireIds?: number[];
  team1Name?: string;
  team2Name?: string;
  subGroupName?: string;
}

/** 20. Implied junction — a fixture can carry more than one official. */
export interface ScheduleUmpireDetail extends Auditable {
  scheduleUmpireId: number;
  scheduleId: number;
  umpireId: number;
  umpireName?: string;
}

/* ------------------------------------------------------------------ *
 * 12-19  Recommended support tables
 * ------------------------------------------------------------------ */

/**
 * 12. Yearly isolation so moderator rotation never collides.
 *
 * An event also carries its own scope. `groupId` / `subGroupId` are nullable
 * and mean "everything": the league itself spans the whole company, while a
 * one-off Cricket knockout is pinned to Sports → Cricket. Match scheduling
 * reads that pin to narrow the teams it will offer, so the scope is a real
 * constraint rather than a label.
 *
 * The year is not stored — it is the season's year, denormalised on the way
 * out so lists and the history filter can read it without a second join.
 */
export interface EventMaster extends Auditable {
  eventId: number;
  /** Short human key, unique. Appears on exports and rule cards. */
  eventCode: string;
  eventName: string;
  seasonId: number;
  groupId?: number | null;
  subGroupId?: number | null;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  seasonName?: string;
  /** Server-computed from the season. */
  year?: number;
  groupName?: string;
  subGroupName?: string;
}

/** 13. */
export interface SeasonMaster extends Auditable {
  seasonId: number;
  seasonName: string;
  year: number;
}

/** 14. */
export interface UserAccount extends Auditable {
  userId: number;
  userName: string;
  email: string;
  displayName: string;
  role: Role;
  subGroupId?: number | null;
  lastLoginOn?: string | null;
  /** Write-only. Never returned by the API. */
  password?: string;
  subGroupName?: string;
}

/**
 * The permission surfaces of the Section 07 matrix.
 *
 * Expanded from the original nine. The old list forced unrelated screens to
 * share a key — the audit log, user accounts and role rights all rode on
 * `groups`, which meant anyone who could read a group could read the audit
 * trail. With four roles that is no longer survivable, so each surface that a
 * role can be granted or denied independently now carries its own key.
 *
 * NOTE FOR THE API: `RolePermission.permissions` is keyed by these strings, so
 * the Web API's seed data has to use the same list. This is the one place the
 * participant rename reaches the wire — the underlying tables keep their
 * `PlayerMaster` / `playerId` names.
 */
export const CAPABILITIES = [
  'dashboard',
  /** The participant register, read from the HR API. */
  'participants',
  /** Group, sub-group, type and type-detail assignment screens. */
  'integration',
  /** Group / sub-group / participant-type / umpire master CRUD. */
  'masters',
  'teams',
  /** Squad composition templates — min/max and per-type ceilings. */
  'formations',
  /** The squad builder and its stadium view. */
  'teamBuilder',
  'allocation',
  'teamGroups',
  /** Event scheduling — the container a match belongs to. */
  'events',
  /** Match scheduling within an event. */
  'schedule',
  'results',
  'rules',
  'users',
  'permissions',
  'audit',
  'exports',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ACTIONS = ['view', 'create', 'edit', 'deactivate'] as const;
export type CapabilityAction = (typeof ACTIONS)[number];

export type CapabilityGrant = Record<CapabilityAction, boolean>;

/** 15. */
export interface RolePermission extends Auditable {
  rolePermissionId: number;
  roleName: string;
  scopeType: 'Global' | 'SubGroup' | 'Self';
  permissions: Record<Capability, CapabilityGrant>;
}

/** 17. */
export interface UmpireMaster extends Auditable {
  umpireId: number;
  umpireName: string;
  contactNo: string;
  email?: string | null;
  accreditationLevel?: string;
  subGroupId?: number | null;
  subGroupName?: string;
}

export const RESULT_METHODS = [
  'Runs',
  'Wickets',
  'Goals',
  'Points',
  'Penalties',
  'SuperOver',
  'Walkover',
  'Forfeit',
] as const;
export type ResultMethod = (typeof RESULT_METHODS)[number];

export const TOSS_DECISIONS = ['Bat', 'Bowl'] as const;
export type TossDecision = (typeof TOSS_DECISIONS)[number];

/**
 * 18. Scores, winners and standings — CLARIFY in the blueprint, built here so
 * the dashboard has something to read from.
 *
 * `winningTeamId` holds the single winner. A draw is `result: 'Tie'` with no
 * winning team, and both sides take the draw points — that pair is how "both
 * teams win" is recorded, rather than a second nullable winner column that
 * would be empty on every other row.
 *
 * The toss, method and award fields are what a scorer actually has in front of
 * them at the end of a match; without them the margin has to be retyped as
 * prose and the awards live nowhere.
 */
export interface MatchResult extends Auditable {
  matchResultId: number;
  scheduleId: number;
  team1Score: number;
  team1Wickets?: number | null;
  team2Score: number;
  team2Wickets?: number | null;
  oversBowled?: number | null;
  result: MatchResultKind;
  winningTeamId?: number | null;
  /** How the match was decided. Drives the margin wording. */
  resultMethod?: ResultMethod | null;
  margin?: string | null;
  pointsTeam1: number;
  pointsTeam2: number;
  tossWonByTeamId?: number | null;
  tossDecision?: TossDecision | null;
  manOfTheMatchPlayerId?: number | null;
  bestBatsmanPlayerId?: number | null;
  bestBowlerPlayerId?: number | null;
  remarks?: string | null;
  /** Denormalised for list views and exports. */
  matchNo?: string;
  winningTeamName?: string;
  tossWonByTeamName?: string;
  manOfTheMatchName?: string;
  bestBatsmanName?: string;
  bestBowlerName?: string;
}

/** 19. Read-only in the UI; written by the server. */
export interface AuditLog {
  auditId: number;
  entityName: string;
  entityId: number;
  action: 'Create' | 'Update' | 'Deactivate' | 'Activate' | 'Login' | 'Logout' | 'Export';
  userName: string;
  timestamp: string;
  details?: string;
}

/* ------------------------------------------------------------------ *
 * Auth + dashboard payloads
 * ------------------------------------------------------------------ */

export interface AuthUser {
  userId: number;
  userName: string;
  displayName: string;
  email: string;
  role: Role;
  subGroupId: number | null;
  subGroupName: string | null;
}

export interface LoginRequest {
  userName: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface DashboardFilters {
  eventId?: number | null;
  groupId?: number | null;
  subGroupId?: number | null;
  from?: string | null;
  to?: string | null;
}

/** One team's line in the points table, computed from match results. */
export interface StandingsRow {
  teamId: number;
  teamName: string;
  teamCode: string;
  subGroupName?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  noResult: number;
  scoreFor: number;
  scoreAgainst: number;
  points: number;
}

/** A band of a stacked bar: one category, several named parts. */
export interface StackedDatum {
  label: string;
  parts: { label: string; value: number }[];
}

export interface DashboardSummary {
  players: number;
  teams: number;
  matches: number;
  activeUsers: number;
  /** Matches with a result recorded, out of those already played. */
  resultsRecorded: number;
  resultsDue: number;
  registrationsBySubGroup: { label: string; value: number; subGroupId: number }[];
  scheduleStatus: { label: ScheduleStatus; value: number }[];
  registrationsOverTime: { label: string; value: number }[];
  teamFill: { label: string; allocated: number; capacity: number; teamId: number }[];
  upcoming: ScheduleMaster[];
  /* --- added once results existed to read from --- */
  standings: StandingsRow[];
  /** Participants by type, stacked within each sub-group. */
  typeComposition: StackedDatum[];
  /** Played against scheduled, week by week. */
  matchesOverTime: { label: string; played: number; scheduled: number }[];
  /** How far down the classification pipeline the register has got. */
  classificationFunnel: { label: string; value: number; hint: string }[];
  /** Most-decorated participants, ranked. */
  topAwards: { label: string; value: number; playerId: number; caption?: string }[];
  /** Decided / drawn / abandoned, across every recorded result. */
  outcomeSplit: { label: string; value: number }[];
}

/**
 * Bulk classification, used by all four assignment screens.
 *
 * Exactly one level is sent per call, and the server clears everything below
 * it — moving a participant to a different sub-group cannot leave it holding a
 * Batsman type from the sport it just left. Putting that rule on the server
 * rather than in the form is deliberate: four screens write this field, and
 * only one of them should have to know the hierarchy.
 *
 * `groupId` is resolved against GroupMaster and stored on the row as
 * `interest`, because PlayerMaster carries the group as an enum rather than a
 * foreign key. IDs travel on the wire so renaming a group in master setup
 * does not orphan anyone.
 */
export interface ClassifyRequest {
  playerIds: number[];
  groupId?: number | null;
  subGroupId?: number | null;
  playerSubTypeId?: number | null;
  playerSubTypeDetailId?: number | null;
}

export interface ClassifyResult {
  updated: number;
  /** Rows the server refused, with the reason — shown inline on the board. */
  skipped: { playerId: number; name: string; reason: string }[];
}

export interface ExportRequest {
  reportType:
    | 'playerMaster'
    | 'teamRoster'
    | 'teamGroups'
    | 'matchSchedule'
    | 'rules'
    | 'dashboardSnapshot'
    /** The history viewer's exact on-screen rows — results, winners, awards. */
    | 'matchHistory'
    /** The derived points table. */
    | 'standings';
  format: ExportFormat;
  filters: HistoryFilters & { teamId?: number | null; status?: string | null };
}

/**
 * The history viewer's filter set.
 *
 * Deliberately the same object the viewer sends to `/api/history` and to the
 * export endpoint, so a downloaded file cannot disagree with the screen it was
 * taken from — the most common reason people stop trusting a report.
 */
export interface HistoryFilters extends DashboardFilters {
  year?: number | null;
  seasonId?: number | null;
  scheduleId?: number | null;
}

/** One played match, flattened for the archive and its exports. */
export interface HistoryRow {
  scheduleId: number;
  matchNo: string;
  matchDate: string;
  matchTime: string;
  eventCode?: string;
  eventName?: string;
  seasonName?: string;
  year?: number;
  subGroupName?: string;
  venue?: string | null;
  team1Name?: string;
  team2Name?: string;
  team1Score: number | null;
  team2Score: number | null;
  scoreLine: string;
  outcome: string;
  winningTeamName: string | null;
  margin?: string | null;
  resultMethod?: string | null;
  manOfTheMatchName?: string | null;
  status: ScheduleStatus;
}

export interface HistoryResult {
  rows: HistoryRow[];
  total: number;
  /** Headline figures for the filtered slice, shown above the table. */
  summary: {
    played: number;
    awaiting: number;
    decided: number;
    drawn: number;
    noResult: number;
  };
  standings: StandingsRow[];
}
