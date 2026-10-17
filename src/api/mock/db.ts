import * as seed from './seed';
import type { ListQuery, PagedResult } from '../types';

/**
 * Mutable in-memory database.
 *
 * Everything is a shallow copy of the seed so a session's edits never mutate the
 * seed module itself — `resetDb()` therefore actually resets.
 */

export interface Collection<T> {
  rows: T[];
  idField: keyof T & string;
}

function collection<T>(rows: T[], idField: keyof T & string): Collection<T> {
  return { rows: rows.map((r) => ({ ...r })), idField };
}

export function createDb() {
  return {
    groups: collection(seed.groups, 'groupId'),
    subGroups: collection(seed.subGroups, 'subGroupId'),
    playerSubTypes: collection(seed.playerSubTypes, 'playerSubTypeId'),
    playerSubTypeDetails: collection(seed.playerSubTypeDetails, 'playerSubTypeDetailId'),
    ruleCards: collection(seed.ruleCards, 'ruleId'),
    players: collection(seed.players, 'playerId'),
    eventTeam: collection(seed.eventTeam, 'eventTeamId'),
    formations: collection(seed.formations, 'formationId'),
    teams: collection(seed.teams, 'teamId'),
    teamAllocations: collection(seed.teamAllocations, 'allocationId'),
    teamGroups: collection(seed.teamGroups, 'teamGroupId'),
    teamGroupDetails: collection(seed.teamGroupDetails, 'teamGroupDetailId'),
    schedules: collection(seed.schedules, 'scheduleId'),
    scheduleUmpires: collection(seed.scheduleUmpires, 'scheduleUmpireId'),
    matchResults: collection(seed.matchResults, 'matchResultId'),
    events: collection(seed.events, 'eventId'),
    seasons: collection(seed.seasons, 'seasonId'),
    users: collection(seed.users, 'userId'),
    rolePermissions: collection(seed.rolePermissions, 'rolePermissionId'),
    umpires: collection(seed.umpires, 'umpireId'),
    auditLogs: collection(seed.auditLogs, 'auditId'),
  };
}

export type Db = ReturnType<typeof createDb>;
export type CollectionName = keyof Db;

export let db: Db = createDb();

export function resetDb(): void {
  db = createDb();
}

/* ------------------------------------------------------------------ *
 * Generic query helpers
 * ------------------------------------------------------------------ */

export function nextId<T>(col: Collection<T>): number {
  let max = 0;
  for (const row of col.rows) {
    const id = Number(row[col.idField]);
    if (id > max) max = id;
  }
  return max + 1;
}

/* Rows are only appended or the array replaced, and ids never change, so identity + length fully invalidates. */
const idIndexes = new WeakMap<object, { length: number; byId: Map<number, unknown> }>();

export function byId<T>(col: Collection<T>): Map<number, T> {
  const cached = idIndexes.get(col.rows);
  if (cached && cached.length === col.rows.length) return cached.byId as Map<number, T>;

  const index = new Map<number, T>();
  for (const row of col.rows) index.set(Number(row[col.idField]), row);
  idIndexes.set(col.rows, { length: col.rows.length, byId: index });
  return index;
}

/** Fields that should never be treated as a filter key. */
const RESERVED = new Set(['page', 'pageSize', 'search', 'sortBy', 'sortDir']);

function matchesSearch(row: Record<string, unknown>, term: string): boolean {
  const needle = term.toLowerCase();
  return Object.values(row).some(
    (value) =>
      (typeof value === 'string' || typeof value === 'number') &&
      String(value).toLowerCase().includes(needle),
  );
}

export function queryCollection<T extends Record<string, unknown>>(
  col: Collection<T>,
  query: ListQuery = {},
): PagedResult<T> {
  let rows = [...col.rows];

  for (const [key, value] of Object.entries(query)) {
    if (RESERVED.has(key) || value === undefined || value === null || value === '') continue;

    if (key === 'isActive') {
      rows = rows.filter((r) => Boolean(r.isActive) === (value === true || value === 'true'));
      continue;
    }
    /* `ids` is a multi-value selector used by the allocation screens. */
    if (key === 'ids' && Array.isArray(value)) {
      const wanted = new Set(value.map(Number));
      rows = rows.filter((r) => wanted.has(Number(r[col.idField])));
      continue;
    }
    if (key in (rows[0] ?? {})) {
      rows = rows.filter((r) => String(r[key]) === String(value));
    }
  }

  if (query.search) {
    rows = rows.filter((r) => matchesSearch(r, String(query.search)));
  }

  if (query.sortBy) {
    const key = query.sortBy;
    const dir = query.sortDir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  const total = rows.length;
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Number(query.pageSize) > 0 ? Number(query.pageSize) : total || 1;
  const start = (page - 1) * pageSize;

  return { items: rows.slice(start, start + pageSize), total, page, pageSize };
}
