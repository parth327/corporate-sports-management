import { config } from '../config';
import { ApiError } from '../errors';
import type { RequestSpec, Transport } from '../transport';
import type {
  AuthUser,
  DashboardSummary,
  ExportRequest,
  HistoryResult,
  HistoryRow,
  PlayerMaster,
  ScheduleMaster,
  ScheduleStatus,
  StandingsRow,
  UserAccount,
} from '../types';
import { tokenStore } from '../tokenStore';
import { byId, db, nextId, queryCollection, resetDb, type CollectionName } from './db';
import { DEMO_PASSWORD } from './constants';
import { CURRENT_EVENT_ID } from './seed';

/**
 * The mock transport.
 *
 * It is deliberately more than a stub: it enforces the six business constraints
 * from Section 05 of the blueprint, so the UI's error paths are exercised during
 * development rather than discovered in production. When you point the app at
 * the real API, the SAME constraints must be enforced server-side — a hidden
 * control is not a permission, and a client-side check is not a constraint.
 */

const abortError = () => new DOMException('The request was aborted.', 'AbortError');

/* Rejects on abort exactly like fetch does, so a superseded request stops before it does any work. */
const latency = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, config.mockLatency + Math.random() * 120);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });

/* Maps the URL segment to a collection in the in-memory db. */
const ROUTES: Record<string, CollectionName> = {
  groups: 'groups',
  subgroups: 'subGroups',
  playersubtypes: 'playerSubTypes',
  playersubtypedetails: 'playerSubTypeDetails',
  rulecards: 'ruleCards',
  players: 'players',
  eventteam: 'eventTeam',
  formations: 'formations',
  teams: 'teams',
  teamallocations: 'teamAllocations',
  teamgroups: 'teamGroups',
  teamgroupdetails: 'teamGroupDetails',
  schedules: 'schedules',
  matchresults: 'matchResults',
  events: 'events',
  seasons: 'seasons',
  users: 'users',
  rolepermissions: 'rolePermissions',
  umpires: 'umpires',
  auditlogs: 'auditLogs',
};

type AnyRow = Record<string, unknown>;

function col(name: CollectionName) {
  return db[name] as unknown as { rows: AnyRow[]; idField: string };
}

function findById(name: CollectionName, id: number): AnyRow | undefined {
  return byId(col(name)).get(id);
}

function lookupName(name: CollectionName, id: unknown, field: string): string | undefined {
  if (id === null || id === undefined || id === '') return undefined;
  const row = findById(name, Number(id));
  return row ? (row[field] as string) : undefined;
}

function log(entityName: string, entityId: number, action: string, details: string): void {
  const c = col('auditLogs');
  c.rows.unshift({
    auditId: nextId(db.auditLogs),
    entityName,
    entityId,
    action,
    userName: actorName(),
    timestamp: new Date().toISOString(),
    details,
  });
}

/* ------------------------------------------------------------------ *
 * Denormalisation — fill the *Name fields a real API would join in
 * ------------------------------------------------------------------ */

/* Child aggregates, computed once per request rather than once per row (the N+1 a list endpoint would otherwise do). */
interface DecorateContext {
  allocatedByTeam?: Map<number, number>;
  teamsByGroup?: Map<number, number>;
  teamsByFormation?: Map<number, number>;
  umpiresBySchedule?: Map<number, number[]>;
}

function countActiveBy(name: CollectionName, key: string): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of col(name).rows) {
    if (!row.isActive) continue;
    const id = Number(row[key]);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function decorateContext(name: CollectionName): DecorateContext {
  switch (name) {
    case 'teams':
      return { allocatedByTeam: countActiveBy('teamAllocations', 'teamId') };
    case 'teamGroups':
      return { teamsByGroup: countActiveBy('teamGroupDetails', 'teamGroupId') };
    case 'formations':
      return { teamsByFormation: countActiveBy('teams', 'formationId') };
    case 'schedules': {
      const bySchedule = new Map<number, number[]>();
      for (const link of col('scheduleUmpires').rows) {
        const scheduleId = Number(link.scheduleId);
        const list = bySchedule.get(scheduleId);
        if (list) list.push(Number(link.umpireId));
        else bySchedule.set(scheduleId, [Number(link.umpireId)]);
      }
      return { umpiresBySchedule: bySchedule };
    }
    default:
      return {};
  }
}

function decorateAll(name: CollectionName, rows: AnyRow[]): AnyRow[] {
  const context = decorateContext(name);
  return rows.map((row) => decorate(name, { ...row }, context));
}

function decorate(
  name: CollectionName,
  row: AnyRow,
  context: DecorateContext = decorateContext(name),
): AnyRow {
  switch (name) {
    case 'subGroups':
      row.groupName = lookupName('groups', row.groupId, 'groupName');
      break;
    case 'playerSubTypes':
    case 'ruleCards':
    case 'teamGroups':
    case 'eventTeam':
    case 'umpires':
      row.subGroupName = lookupName('subGroups', row.subGroupId, 'subGroupName');
      break;
    case 'teams':
      row.subGroupName = lookupName('subGroups', row.subGroupId, 'subGroupName');
      row.formationName = lookupName('formations', row.formationId, 'formationName');
      break;
    case 'formations':
      row.subGroupName = lookupName('subGroups', row.subGroupId, 'subGroupName');
      /* Slot type names are denormalised on the way out so the rules screen
         and the squad builder can label a slot without a second round trip. */
      if (Array.isArray(row.slots)) {
        row.slots = (row.slots as AnyRow[]).map((slot) => ({
          ...slot,
          playerSubTypeName: lookupName('playerSubTypes', slot.playerSubTypeId, 'subTypeName'),
        }));
      }
      break;
    case 'playerSubTypeDetails':
      row.playerSubTypeName = lookupName('playerSubTypes', row.playerSubTypeId, 'subTypeName');
      break;
    case 'players':
      row.subGroupName = lookupName('subGroups', row.subGroupId, 'subGroupName');
      row.playerSubTypeName = lookupName('playerSubTypes', row.playerSubTypeId, 'subTypeName');
      row.playerSubTypeDetailName = lookupName(
        'playerSubTypeDetails',
        row.playerSubTypeDetailId,
        'detailName',
      );
      break;
    case 'teamAllocations':
      row.playerName = lookupName('players', row.playerId, 'name');
      row.teamName = lookupName('teams', row.teamId, 'teamName');
      break;
    case 'teamGroupDetails': {
      row.teamName = lookupName('teams', row.teamId, 'teamName');
      const group = findById('teamGroups', Number(row.teamGroupId));
      row.teamGroupName = group
        ? `${lookupName('subGroups', group.subGroupId, 'subGroupName')} — ${group.groupName}`
        : undefined;
      break;
    }
    case 'schedules':
      row.team1Name = lookupName('teams', row.team1Id, 'teamName');
      row.team2Name = lookupName('teams', row.team2Id, 'teamName');
      row.subGroupName = lookupName('subGroups', row.subGroupId, 'subGroupName');
      row.umpireIds = [...(context.umpiresBySchedule?.get(Number(row.scheduleId)) ?? [])];
      break;
    case 'matchResults':
      row.matchNo = lookupName('schedules', row.scheduleId, 'matchNo');
      row.winningTeamName = lookupName('teams', row.winningTeamId, 'teamName');
      row.tossWonByTeamName = lookupName('teams', row.tossWonByTeamId, 'teamName');
      row.manOfTheMatchName = lookupName('players', row.manOfTheMatchPlayerId, 'name');
      row.bestBatsmanName = lookupName('players', row.bestBatsmanPlayerId, 'name');
      row.bestBowlerName = lookupName('players', row.bestBowlerPlayerId, 'name');
      break;
    case 'users':
      row.subGroupName = lookupName('subGroups', row.subGroupId, 'subGroupName');
      delete row.password;
      break;
    case 'events': {
      row.seasonName = lookupName('seasons', row.seasonId, 'seasonName');
      const season = findById('seasons', Number(row.seasonId));
      row.year = season ? Number(season.year) : undefined;
      row.groupName = lookupName('groups', row.groupId, 'groupName');
      row.subGroupName = lookupName('subGroups', row.subGroupId, 'subGroupName');
      break;
    }
    default:
      break;
  }

  if (name === 'teams') {
    row.allocatedCount = context.allocatedByTeam?.get(Number(row.teamId)) ?? 0;
  }
  if (name === 'teamGroups') {
    row.teamCount = context.teamsByGroup?.get(Number(row.teamGroupId)) ?? 0;
  }
  if (name === 'formations') {
    row.teamCount = context.teamsByFormation?.get(Number(row.formationId)) ?? 0;
  }

  return row;
}

/* ------------------------------------------------------------------ *
 * Business constraints (Section 05)
 * ------------------------------------------------------------------ */

function assertActiveReference(
  name: CollectionName,
  id: unknown,
  field: string,
  label: string,
): void {
  if (id === null || id === undefined || id === '') return;
  const row = findById(name, Number(id));
  if (!row) throw new ApiError(`${label} not found.`, 404, { [field]: `${label} not found.` });
  /* Constraint 4 — inactive master records cannot be selected for a new row. */
  if (!row.isActive) {
    throw new ApiError(`${label} is inactive and cannot be selected.`, 400, {
      [field]: `${label} is inactive.`,
    });
  }
}

function validateAllocation(payload: AnyRow, existingId?: number): void {
  const playerId = Number(payload.playerId);
  const teamId = Number(payload.teamId);

  assertActiveReference('players', playerId, 'playerId', 'Player');
  assertActiveReference('teams', teamId, 'teamId', 'Team');

  const player = findById('players', playerId) as PlayerMaster | undefined;
  const team = findById('teams', teamId) as AnyRow | undefined;
  if (!player || !team) return;

  if (player.status !== 'Active') {
    throw new ApiError('Only activated players can be allocated to a team.', 400, {
      playerId: `${player.name} is ${player.status.toLowerCase()}, not active.`,
    });
  }

  if (player.subGroupId !== null && Number(player.subGroupId) !== Number(team.subGroupId)) {
    throw new ApiError('Player and team belong to different sub-groups.', 400, {
      teamId: `${player.name} is registered for ${player.subGroupName ?? 'another sub-group'}.`,
    });
  }

  /* Constraint 1 — at most one ACTIVE allocation per player per event. */
  const clash = col('teamAllocations').rows.find(
    (a) =>
      a.isActive &&
      Number(a.playerId) === playerId &&
      Number(a.eventId) === Number(payload.eventId ?? CURRENT_EVENT_ID) &&
      Number(a.allocationId) !== existingId,
  );
  if (clash) {
    throw new ApiError(
      `${player.name} is already allocated to ${lookupName('teams', clash.teamId, 'teamName')} this season.`,
      409,
      { playerId: 'This player already holds an active allocation.' },
    );
  }

  /* Constraint 2 — capacity ceiling. */
  const filled = col('teamAllocations').rows.filter(
    (a) => a.isActive && Number(a.teamId) === teamId && Number(a.allocationId) !== existingId,
  ).length;
  if (filled >= Number(team.maxPlayers)) {
    throw new ApiError(`${team.teamName} is full (${team.maxPlayers} participants).`, 409, {
      teamId: `Capacity of ${team.maxPlayers} reached.`,
    });
  }

  /* Constraint 3 — the formation's per-type ceiling.
     Squad size alone is not enough: a side of twelve that happens to be
     eleven bowlers is within capacity and still cannot take the field. The
     squad builder draws exactly this many slots, so a UI that respects the
     formation never trips it — but the rule belongs here, because the older
     allocation screen writes the same table and knows nothing about shape. */
  if (team.formationId) {
    const formation = findById('formations', Number(team.formationId));
    const slot = (formation?.slots as AnyRow[] | undefined)?.find(
      (s) => Number(s.playerSubTypeId) === Number(player.playerSubTypeId),
    );

    if (formation && player.playerSubTypeId) {
      if (!slot) {
        throw new ApiError(
          `${formation.formationName} has no place for a ${player.playerSubTypeName ?? 'that type'}.`,
          409,
          { playerId: 'Type is not part of this formation.' },
        );
      }

      const sameType = col('teamAllocations').rows.filter((a) => {
        if (!a.isActive || Number(a.teamId) !== teamId) return false;
        if (Number(a.allocationId) === existingId) return false;
        const other = findById('players', Number(a.playerId));
        return Number(other?.playerSubTypeId) === Number(player.playerSubTypeId);
      }).length;

      if (sameType >= Number(slot.max)) {
        const typeName = player.playerSubTypeName ?? 'that type';
        throw new ApiError(
          `${team.teamName} already holds ${slot.max} ${typeName}${Number(slot.max) === 1 ? '' : 's'}, the most ${formation.formationName} allows.`,
          409,
          { playerId: `No ${typeName} slots left.` },
        );
      }
    }
  }
}

function validateSchedule(payload: AnyRow, existingId?: number): void {
  const team1Id = Number(payload.team1Id);
  const team2Id = Number(payload.team2Id);

  assertActiveReference('teams', team1Id, 'team1Id', 'Team 1');
  assertActiveReference('teams', team2Id, 'team2Id', 'Team 2');

  /* Constraint 3a — the two sides must differ. */
  if (team1Id === team2Id) {
    throw new ApiError('A team cannot play itself.', 400, {
      team2Id: 'Choose a different team from Team 1.',
    });
  }

  const t1 = findById('teams', team1Id);
  const t2 = findById('teams', team2Id);

  /* Constraint 3b — and share a competition scope. */
  if (t1 && t2 && Number(t1.subGroupId) !== Number(t2.subGroupId)) {
    throw new ApiError('Both teams must belong to the same sub-group.', 400, {
      team2Id: `${t2.teamName} is not in ${lookupName('subGroups', t1.subGroupId, 'subGroupName')}.`,
    });
  }

  /* A fixture has to sit inside the event that contains it. An event pinned to
     Cricket cannot hold a Football match, and neither can one whose window has
     closed — otherwise the event stops meaning anything as a reporting key. */
  const event = findById('events', Number(payload.eventId));
  if (event) {
    if (event.subGroupId && Number(event.subGroupId) !== Number(payload.subGroupId)) {
      throw new ApiError(
        `${event.eventName} only covers ${lookupName('subGroups', event.subGroupId, 'subGroupName')}.`,
        400,
        { subGroupId: 'Outside this event’s scope.' },
      );
    }
    if (event.groupId && !event.subGroupId) {
      const sub = findById('subGroups', Number(payload.subGroupId));
      if (sub && Number(sub.groupId) !== Number(event.groupId)) {
        throw new ApiError(
          `${event.eventName} only covers ${lookupName('groups', event.groupId, 'groupName')}.`,
          400,
          { subGroupId: 'Outside this event’s scope.' },
        );
      }
    }
    const date = String(payload.matchDate ?? '');
    if (date && (date < String(event.startDate) || date > String(event.endDate))) {
      throw new ApiError(
        `${event.eventName} runs ${event.startDate} to ${event.endDate}.`,
        400,
        { matchDate: 'Outside the event window.' },
      );
    }
  }

  /* Constraint 6 — no double-booking of a team or an official in one slot. */
  const sameSlot = col('schedules').rows.filter(
    (s) =>
      s.isActive &&
      Number(s.scheduleId) !== existingId &&
      s.matchDate === payload.matchDate &&
      s.matchTime === payload.matchTime,
  );

  for (const other of sameSlot) {
    if (
      [Number(other.team1Id), Number(other.team2Id)].some((id) => id === team1Id || id === team2Id)
    ) {
      throw new ApiError(
        `A team in this fixture already plays ${other.matchNo} at that time.`,
        409,
        { matchTime: 'Team already booked in this slot.' },
      );
    }
  }

  const wantedOfficials = new Set((payload.umpireIds as number[] | undefined) ?? []);
  if (wantedOfficials.size) {
    for (const other of sameSlot) {
      const booked = col('scheduleUmpires').rows.filter(
        (u) => Number(u.scheduleId) === Number(other.scheduleId),
      );
      const conflict = booked.find((u) => wantedOfficials.has(Number(u.umpireId)));
      if (conflict) {
        throw new ApiError(
          `${lookupName('umpires', conflict.umpireId, 'umpireName')} is already officiating ${other.matchNo}.`,
          409,
          { umpireIds: 'Official already booked in this slot.' },
        );
      }
    }
  }
}

/**
 * A formation has to be internally possible before anyone builds against it.
 *
 * The check that actually matters is the last one: if every type is filled to
 * its floor and that already exceeds the squad ceiling, the formation can
 * never be satisfied, and the squad builder would show a target no team could
 * ever hit. Catching it here means the shape is wrong at the moment someone
 * writes it, not weeks later when a moderator cannot finish a squad.
 */
function validateFormation(payload: AnyRow, existingId?: number): void {
  const min = Number(payload.minPlayers);
  const max = Number(payload.maxPlayers);

  if (!Number.isFinite(min) || min < 1) {
    throw new ApiError('Minimum players must be at least 1.', 400, {
      minPlayers: 'Must be at least 1.',
    });
  }
  if (!Number.isFinite(max) || max < min) {
    throw new ApiError('Maximum players cannot be below the minimum.', 400, {
      maxPlayers: `Must be ${min} or more.`,
    });
  }

  const duplicate = col('formations').rows.find(
    (f) =>
      String(f.formationCode).toLowerCase() === String(payload.formationCode ?? '').toLowerCase() &&
      Number(f.formationId) !== existingId,
  );
  if (duplicate) {
    throw new ApiError('That formation code is already in use.', 409, {
      formationCode: 'Already in use.',
    });
  }

  const slots = Array.isArray(payload.slots) ? (payload.slots as AnyRow[]) : [];
  let floor = 0;
  let ceiling = 0;

  for (const slot of slots) {
    const type = findById('playerSubTypes', Number(slot.playerSubTypeId));
    const label = type ? String(type.subTypeName) : `type ${slot.playerSubTypeId}`;
    const slotMin = Number(slot.min ?? 0);
    const slotMax = Number(slot.max ?? 0);

    if (type && Number(type.subGroupId) !== Number(payload.subGroupId)) {
      throw new ApiError(`${label} belongs to a different sub-group.`, 400);
    }
    if (slotMax < slotMin) {
      throw new ApiError(`${label}: maximum cannot be below the minimum.`, 400);
    }
    floor += slotMin;
    ceiling += slotMax;
  }

  if (slots.length) {
    if (floor > max) {
      throw new ApiError(
        `The per-type minimums add up to ${floor}, which is more than the squad maximum of ${max}.`,
        400,
        { maxPlayers: `Needs to be at least ${floor}.` },
      );
    }
    if (ceiling < min) {
      throw new ApiError(
        `The per-type maximums only add up to ${ceiling}, so a squad can never reach its minimum of ${min}.`,
        400,
        { minPlayers: `Cannot exceed ${ceiling}.` },
      );
    }
  }
}

/**
 * An event is the container everything else is stamped with, so its own shape
 * has to hold before anything can be scheduled inside it.
 *
 * The scope check is the one worth having: pinning an event to Cricket while
 * naming Cultural as its group would let match scheduling offer teams the event
 * does not cover, and nothing downstream would notice.
 */
function validateEvent(payload: AnyRow, existingId?: number): void {
  const code = String(payload.eventCode ?? '').trim();
  if (!code) {
    throw new ApiError('An event code is required.', 400, { eventCode: 'Required.' });
  }

  const duplicate = col('events').rows.find(
    (e) =>
      String(e.eventCode ?? '').toLowerCase() === code.toLowerCase() &&
      Number(e.eventId) !== existingId,
  );
  if (duplicate) {
    throw new ApiError('That event code is already in use.', 409, {
      eventCode: 'Already in use.',
    });
  }

  assertActiveReference('seasons', payload.seasonId, 'seasonId', 'Season');
  assertActiveReference('groups', payload.groupId, 'groupId', 'Group');
  assertActiveReference('subGroups', payload.subGroupId, 'subGroupId', 'Sub-group');

  if (payload.subGroupId && payload.groupId) {
    const sub = findById('subGroups', Number(payload.subGroupId));
    if (sub && Number(sub.groupId) !== Number(payload.groupId)) {
      throw new ApiError('That sub-group belongs to a different group.', 400, {
        subGroupId: `${sub.subGroupName} is not in ${lookupName('groups', payload.groupId, 'groupName')}.`,
      });
    }
  }

  const from = String(payload.startDate ?? '');
  const to = String(payload.endDate ?? '');
  if (from && to && to < from) {
    throw new ApiError('The end date cannot fall before the start date.', 400, {
      endDate: 'Must be on or after the start date.',
    });
  }

  /* Only one event can be current — flipping the flag clears the others
     rather than refusing, because "make this the live one" is the intent. */
  if (payload.isCurrent) {
    for (const other of col('events').rows) {
      if (Number(other.eventId) !== existingId) other.isCurrent = false;
    }
  }
}

/**
 * A result has to agree with the fixture it belongs to.
 *
 * The winner check is the substantive one. The scorer picks the winner rather
 * than having it inferred, because a match can be awarded on a walkover or a
 * super over where the printed scores do not decide it — but they still cannot
 * name a team that did not play, and a draw cannot have a winner at all.
 */
function validateMatchResult(payload: AnyRow, existingId?: number): void {
  const scheduleId = Number(payload.scheduleId);
  const fixture = findById('schedules', scheduleId);
  if (!fixture) {
    throw new ApiError('That fixture no longer exists.', 404, { scheduleId: 'Fixture not found.' });
  }

  const duplicate = col('matchResults').rows.find(
    (r) =>
      r.isActive &&
      Number(r.scheduleId) === scheduleId &&
      Number(r.matchResultId) !== existingId,
  );
  if (duplicate) {
    throw new ApiError(`${fixture.matchNo} already has a result recorded.`, 409, {
      scheduleId: 'Edit the existing result instead.',
    });
  }

  const sides = [Number(fixture.team1Id), Number(fixture.team2Id)];
  const kind = String(payload.result);

  if (kind === 'Win') {
    const winner = Number(payload.winningTeamId);
    if (!winner) {
      throw new ApiError('Choose the winning team.', 400, {
        winningTeamId: 'Required unless the match was drawn or abandoned.',
      });
    }
    if (!sides.includes(winner)) {
      throw new ApiError('That team did not play this fixture.', 400, {
        winningTeamId: 'Must be one of the two sides.',
      });
    }
  } else if (payload.winningTeamId) {
    throw new ApiError(
      kind === 'Tie'
        ? 'A drawn match has no single winner — both sides share the points.'
        : 'An abandoned match has no winner.',
      400,
      { winningTeamId: 'Leave empty for this outcome.' },
    );
  }

  if (payload.tossWonByTeamId && !sides.includes(Number(payload.tossWonByTeamId))) {
    throw new ApiError('That team did not play this fixture.', 400, {
      tossWonByTeamId: 'Must be one of the two sides.',
    });
  }

  /* Awards have to go to someone actually allocated to one of the two sides. */
  const squad = new Set(
    col('teamAllocations')
      .rows.filter((a) => a.isActive && sides.includes(Number(a.teamId)))
      .map((a) => Number(a.playerId)),
  );
  const awards: [string, string][] = [
    ['manOfTheMatchPlayerId', 'Player of the match'],
    ['bestBatsmanPlayerId', 'Best batter'],
    ['bestBowlerPlayerId', 'Best bowler'],
  ];
  for (const [field, label] of awards) {
    const id = payload[field];
    if (id && !squad.has(Number(id))) {
      throw new ApiError(`${label} is not in either squad.`, 400, {
        [field]: 'Not in either squad.',
      });
    }
  }
}

function applyConstraints(name: CollectionName, payload: AnyRow, existingId?: number): void {
  switch (name) {
    case 'teamAllocations':
      validateAllocation(payload, existingId);
      break;
    case 'schedules':
      validateSchedule(payload, existingId);
      break;
    case 'events':
      validateEvent(payload, existingId);
      break;
    case 'matchResults':
      validateMatchResult(payload, existingId);
      break;
    case 'subGroups':
      assertActiveReference('groups', payload.groupId, 'groupId', 'Group');
      break;
    case 'teams':
    case 'teamGroups':
    case 'ruleCards':
    case 'playerSubTypes':
      assertActiveReference('subGroups', payload.subGroupId, 'subGroupId', 'Sub-group');
      break;
    case 'formations':
      assertActiveReference('subGroups', payload.subGroupId, 'subGroupId', 'Sub-group');
      validateFormation(payload, existingId);
      break;
    case 'playerSubTypeDetails':
      assertActiveReference('playerSubTypes', payload.playerSubTypeId, 'playerSubTypeId', 'Player type');
      break;
    case 'teamGroupDetails': {
      assertActiveReference('teamGroups', payload.teamGroupId, 'teamGroupId', 'Team group');
      assertActiveReference('teams', payload.teamId, 'teamId', 'Team');
      const duplicate = col('teamGroupDetails').rows.find(
        (d) =>
          d.isActive &&
          Number(d.teamGroupId) === Number(payload.teamGroupId) &&
          Number(d.teamId) === Number(payload.teamId) &&
          Number(d.teamGroupDetailId) !== existingId,
      );
      if (duplicate) {
        throw new ApiError('That team is already in this group.', 409, {
          teamId: 'Already a member of this group.',
        });
      }
      break;
    }
    case 'users': {
      const duplicate = col('users').rows.find(
        (u) =>
          String(u.userName).toLowerCase() === String(payload.userName).toLowerCase() &&
          Number(u.userId) !== existingId,
      );
      if (duplicate) {
        throw new ApiError('That username is taken.', 409, { userName: 'Already in use.' });
      }
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

let currentUser: AuthUser | null = null;

/**
 * Who the server thinks is acting.
 *
 * `currentUser` is module state, so a page refresh wipes it — while the client
 * restores its session from storage and carries on without signing in again.
 * Every write after a refresh was therefore stamped `system` in the audit log
 * rather than the person who made it. For a trail whose entire job is
 * attribution that is not cosmetic: it names the wrong principal, silently,
 * for the majority of a working session.
 *
 * So the session is recovered from the stored token on first use, exactly as
 * a real API recovers it from the bearer token on every request.
 */
function actor(): AuthUser | null {
  if (currentUser) return currentUser;

  const stored = tokenStore.user;
  if (!stored) return null;

  /* Trust the row, not the stored copy — the account may have been edited or
     deactivated since the token was issued. */
  const account = col('users').rows.find(
    (u) => String(u.userName).toLowerCase() === stored.userName.toLowerCase(),
  ) as UserAccount | undefined;
  if (!account || !account.isActive) return null;

  currentUser = toAuthUser(account);
  return currentUser;
}

/** The name to stamp on a write. */
const actorName = (): string => actor()?.userName ?? 'system';

function toAuthUser(u: UserAccount): AuthUser {
  return {
    userId: u.userId,
    userName: u.userName,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    subGroupId: u.subGroupId ?? null,
    subGroupName: u.subGroupId
      ? (lookupName('subGroups', u.subGroupId, 'subGroupName') ?? null)
      : null,
  };
}

function handleLogin(spec: RequestSpec): unknown {
  /* Bearer strategy posts a URL-encoded OAuth grant; cookie strategy posts JSON. */
  let userName = '';
  let password = '';

  if (typeof spec.rawBody === 'string') {
    /* The bearer strategy sends a form-encoded OAuth grant; the cookie strategy
       sends JSON. Both arrive as a pre-encoded string, so sniff which. */
    const raw = spec.rawBody.trim();
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as AnyRow;
      userName = String(parsed.userName ?? parsed.username ?? '');
      password = String(parsed.password ?? '');
    } else {
      const params = new URLSearchParams(raw);
      userName = params.get('username') ?? '';
      password = params.get('password') ?? '';
    }
  } else if (spec.body && typeof spec.body === 'object') {
    const b = spec.body as AnyRow;
    userName = String(b.userName ?? '');
    password = String(b.password ?? '');
  }

  const account = col('users').rows.find(
    (u) => String(u.userName).toLowerCase() === userName.trim().toLowerCase(),
  ) as UserAccount | undefined;

  if (!account || password !== DEMO_PASSWORD) {
    throw new ApiError('That username and password do not match.', 400, {}, {
      error: 'invalid_grant',
      error_description: 'That username and password do not match.',
    });
  }
  if (!account.isActive) {
    throw new ApiError('This account has been deactivated. Contact the Main Administrator.', 403);
  }

  currentUser = toAuthUser(account);
  account.lastLoginOn = new Date().toISOString();
  log('UserAccount', account.userId, 'Login', `${account.userName} signed in`);

  return {
    access_token: `mock.${btoa(account.userName)}.${Date.now()}`,
    token_type: 'bearer',
    expires_in: 60 * 60 * 8,
    userName: account.userName,
    role: account.role,
    user: currentUser,
  };
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

function buildDashboard(query: AnyRow): DashboardSummary {
  const subGroupFilter = query.subGroupId ? Number(query.subGroupId) : null;
  const groupFilter = query.groupId ? Number(query.groupId) : null;

  const inScope = (subGroupId: unknown): boolean => {
    if (subGroupFilter !== null) return Number(subGroupId) === subGroupFilter;
    if (groupFilter !== null) {
      const sg = findById('subGroups', Number(subGroupId));
      return sg ? Number(sg.groupId) === groupFilter : false;
    }
    return true;
  };

  const players = col('players').rows.filter((p) => p.isActive && inScope(p.subGroupId));
  const teams = col('teams').rows.filter((t) => t.isActive && inScope(t.subGroupId));
  const schedules = col('schedules').rows.filter((s) => s.isActive && inScope(s.subGroupId));

  const registrationsBySubGroup = col('subGroups')
    .rows.filter((sg) => sg.isActive && inScope(sg.subGroupId))
    .map((sg) => ({
      subGroupId: Number(sg.subGroupId),
      label: String(sg.subGroupName),
      value: players.filter((p) => Number(p.subGroupId) === Number(sg.subGroupId)).length,
    }));

  const statuses: ScheduleStatus[] = ['Scheduled', 'Completed', 'Pending', 'Cancelled'];
  const scheduleStatus = statuses
    .map((label) => ({ label, value: schedules.filter((s) => s.status === label).length }))
    .filter((s) => s.value > 0);

  /* Eight weekly buckets of cumulative registrations. */
  const registrationsOverTime: { label: string; value: number }[] = [];
  const now = new Date('2026-09-18T00:00:00Z');
  for (let week = 7; week >= 0; week -= 1) {
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - week * 7);
    registrationsOverTime.push({
      label: `Wk ${8 - week}`,
      value: players.filter(
        (p) => typeof p.registeredOn === 'string' && new Date(p.registeredOn) <= cutoff,
      ).length,
    });
  }

  const teamFill = teams.slice(0, 8).map((t) => ({
    teamId: Number(t.teamId),
    label: String(t.teamCode),
    allocated: col('teamAllocations').rows.filter(
      (a) => a.isActive && Number(a.teamId) === Number(t.teamId),
    ).length,
    capacity: Number(t.maxPlayers),
  }));

  const upcoming = decorateAll(
    'schedules',
    schedules
      .filter((s) => s.status === 'Scheduled' || s.status === 'Pending')
      .sort((a, b) => `${a.matchDate}${a.matchTime}`.localeCompare(`${b.matchDate}${b.matchTime}`))
      .slice(0, 5),
  ) as unknown as ScheduleMaster[];

  /* ---------------------------------------------------------------- *
   * Everything below reads from match results, which is why none of it
   * existed before results were enterable. The standings in particular
   * are derived, never stored — a points table that can drift from the
   * results it is meant to summarise is worse than no points table.
   * ---------------------------------------------------------------- */

  const scheduleIds = new Set(schedules.map((s) => Number(s.scheduleId)));
  const results = col('matchResults').rows.filter(
    (r) => r.isActive && scheduleIds.has(Number(r.scheduleId)),
  );
  const resultByScheduleId = new Map(results.map((r) => [Number(r.scheduleId), r]));

  const standings = teams
    .map((team) => {
      const teamId = Number(team.teamId);
      const row = {
        teamId,
        teamName: String(team.teamName),
        teamCode: String(team.teamCode),
        subGroupName: lookupName('subGroups', team.subGroupId, 'subGroupName'),
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        noResult: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        points: 0,
      };

      for (const fixture of schedules) {
        const isHome = Number(fixture.team1Id) === teamId;
        const isAway = Number(fixture.team2Id) === teamId;
        if (!isHome && !isAway) continue;

        const result = resultByScheduleId.get(Number(fixture.scheduleId));
        if (!result) continue;

        row.played += 1;
        row.scoreFor += Number(isHome ? result.team1Score : result.team2Score);
        row.scoreAgainst += Number(isHome ? result.team2Score : result.team1Score);
        row.points += Number(isHome ? result.pointsTeam1 : result.pointsTeam2);

        if (result.result === 'Tie') row.drawn += 1;
        else if (result.result === 'NoResult') row.noResult += 1;
        else if (Number(result.winningTeamId) === teamId) row.won += 1;
        else row.lost += 1;
      }

      return row;
    })
    .filter((row) => row.played > 0)
    /* Points, then score difference — the ordering every league uses. */
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.scoreFor - b.scoreAgainst - (a.scoreFor - a.scoreAgainst) ||
        a.teamName.localeCompare(b.teamName),
    );

  const typeComposition = col('subGroups')
    .rows.filter((sg) => sg.isActive && inScope(sg.subGroupId))
    .map((sg) => {
      const types = col('playerSubTypes').rows.filter(
        (t) => t.isActive && Number(t.subGroupId) === Number(sg.subGroupId),
      );
      const parts = types.map((t) => ({
        label: String(t.subTypeName),
        value: players.filter((p) => Number(p.playerSubTypeId) === Number(t.playerSubTypeId)).length,
      }));
      const classified = parts.reduce((sum, p) => sum + p.value, 0);
      const unclassified = players.filter(
        (p) => Number(p.subGroupId) === Number(sg.subGroupId) && !p.playerSubTypeId,
      ).length;
      return {
        label: String(sg.subGroupName),
        parts: unclassified ? [...parts, { label: 'Unclassified', value: unclassified }] : parts,
        total: classified + unclassified,
      };
    })
    /* A sub-group with nobody in it is a row of zeroes, not information. */
    .filter((band) => band.total > 0)
    .map(({ label, parts }) => ({ label, parts }));

  /* Eight weekly buckets: what was played against what was on the card. */
  const matchesOverTime: { label: string; played: number; scheduled: number }[] = [];
  for (let week = 7; week >= 0; week -= 1) {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() - week * 7);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 7);

    const inWeek = schedules.filter((s) => {
      const date = new Date(String(s.matchDate));
      return date > start && date <= end;
    });

    matchesOverTime.push({
      label: `Wk ${8 - week}`,
      scheduled: inWeek.length,
      played: inWeek.filter((s) => resultByScheduleId.has(Number(s.scheduleId))).length,
    });
  }

  /**
   * The classification pipeline as a funnel.
   *
   * Each step is a strict subset of the one above it, so the shape reads as
   * drop-off: where the register stops being useful. This is the one chart a
   * Management Team actually acts on — it names the next batch of work.
   */
  const allocatedIds = new Set(
    col('teamAllocations')
      .rows.filter((a) => a.isActive)
      .map((a) => Number(a.playerId)),
  );
  const classificationFunnel = [
    {
      label: 'On the register',
      value: players.length,
      hint: 'Active participants from the HR feed',
    },
    {
      label: 'In a group',
      value: players.filter((p) => p.interest && p.interest !== 'None').length,
      hint: 'Sports or Cultural',
    },
    {
      label: 'In a sub-group',
      value: players.filter((p) => p.subGroupId).length,
      hint: 'Cricket, Football, Cultural',
    },
    {
      label: 'Typed',
      value: players.filter((p) => p.playerSubTypeId).length,
      hint: 'Batsman, bowler, keeper…',
    },
    {
      label: 'In a squad',
      value: players.filter((p) => allocatedIds.has(Number(p.playerId))).length,
      hint: 'Allocated to a team',
    },
  ];

  const awardCounts = new Map<number, number>();
  for (const result of results) {
    for (const field of ['manOfTheMatchPlayerId', 'bestBatsmanPlayerId', 'bestBowlerPlayerId']) {
      const id = result[field];
      if (id) awardCounts.set(Number(id), (awardCounts.get(Number(id)) ?? 0) + 1);
    }
  }
  const topAwards = [...awardCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([playerId, value]) => {
      const player = findById('players', playerId);
      return {
        playerId,
        value,
        label: player ? String(player.name) : `#${playerId}`,
        caption: player ? lookupName('subGroups', player.subGroupId, 'subGroupName') : undefined,
      };
    });

  const outcomeSplit = [
    { label: 'Decided', value: results.filter((r) => r.result === 'Win').length },
    { label: 'Drawn', value: results.filter((r) => r.result === 'Tie').length },
    { label: 'No result', value: results.filter((r) => r.result === 'NoResult').length },
  ].filter((o) => o.value > 0);

  /* "Due" means played but unscored — the actionable number, not the total. */
  const resultsDue = schedules.filter(
    (s) => s.status === 'Completed' && !resultByScheduleId.has(Number(s.scheduleId)),
  ).length;

  return {
    players: players.length,
    teams: teams.length,
    matches: schedules.length,
    activeUsers: col('users').rows.filter((u) => u.isActive).length,
    resultsRecorded: results.length,
    resultsDue,
    registrationsBySubGroup,
    scheduleStatus,
    registrationsOverTime,
    teamFill,
    upcoming,
    standings,
    typeComposition,
    matchesOverTime,
    classificationFunnel,
    topAwards,
    outcomeSplit,
  };
}

/* ------------------------------------------------------------------ *
 * History — the archive, filtered by year / season / event / match
 * ------------------------------------------------------------------ */

/**
 * One query serves both the viewer and its exports.
 *
 * The filters cascade the way the UI presents them — a year narrows the
 * seasons, a season the events, an event the matches — but each level is also
 * applied independently on the server, so a hand-built query that skips a
 * level still returns a coherent slice rather than everything.
 */
function buildHistory(query: AnyRow): HistoryResult {
  /**
   * "Absent" has three spellings here.
   *
   * The HTTP transport strips nulls out of the query string, so a real API
   * only ever sees a missing key. The mock is handed the filter object as-is,
   * nulls included — and `Number(null)` is 0, which silently filtered every
   * row out rather than filtering nothing. No id or year in this system is
   * legitimately 0, so all three spellings collapse to null.
   */
  const num = (value: unknown) =>
    value === undefined || value === null || value === '' || Number(value) === 0
      ? null
      : Number(value);
  const year = num(query.year);
  const seasonId = num(query.seasonId);
  const eventId = num(query.eventId);
  const groupId = num(query.groupId);
  const subGroupId = num(query.subGroupId);
  const scheduleId = num(query.scheduleId);

  /* Resolve the year to the set of events it covers, rather than stamping a
     year onto every fixture — the season owns the year, and duplicating it
     onto the fixture is how the two drift apart. */
  const events = col('events').rows.filter((event) => {
    if (eventId !== null && Number(event.eventId) !== eventId) return false;
    if (seasonId !== null && Number(event.seasonId) !== seasonId) return false;
    if (year !== null) {
      const season = findById('seasons', Number(event.seasonId));
      if (!season || Number(season.year) !== year) return false;
    }
    return true;
  });
  const eventIds = new Set(events.map((e) => Number(e.eventId)));
  const eventById = new Map(events.map((e) => [Number(e.eventId), e]));

  const inScope = (sgId: unknown): boolean => {
    if (subGroupId !== null) return Number(sgId) === subGroupId;
    if (groupId !== null) {
      const sg = findById('subGroups', Number(sgId));
      return sg ? Number(sg.groupId) === groupId : false;
    }
    return true;
  };

  const fixtures = col('schedules')
    .rows.filter(
      (s) =>
        s.isActive &&
        eventIds.has(Number(s.eventId)) &&
        inScope(s.subGroupId) &&
        (scheduleId === null || Number(s.scheduleId) === scheduleId),
    )
    .sort((a, b) =>
      `${b.matchDate}${b.matchTime}`.localeCompare(`${a.matchDate}${a.matchTime}`),
    );

  const results = new Map(
    col('matchResults')
      .rows.filter((r) => r.isActive)
      .map((r) => [Number(r.scheduleId), r]),
  );

  const rows: HistoryRow[] = fixtures.map((fixture) => {
    const result = results.get(Number(fixture.scheduleId));
    const event = eventById.get(Number(fixture.eventId));
    const season = event ? findById('seasons', Number(event.seasonId)) : undefined;

    const wickets = (score: unknown, w: unknown) =>
      w === null || w === undefined ? String(score) : `${score}/${w}`;

    return {
      scheduleId: Number(fixture.scheduleId),
      matchNo: String(fixture.matchNo),
      matchDate: String(fixture.matchDate),
      matchTime: String(fixture.matchTime),
      eventCode: event ? String(event.eventCode) : undefined,
      eventName: event ? String(event.eventName) : undefined,
      seasonName: season ? String(season.seasonName) : undefined,
      year: season ? Number(season.year) : undefined,
      subGroupName: lookupName('subGroups', fixture.subGroupId, 'subGroupName'),
      venue: (fixture.venue as string | null) ?? null,
      team1Name: lookupName('teams', fixture.team1Id, 'teamName'),
      team2Name: lookupName('teams', fixture.team2Id, 'teamName'),
      team1Score: result ? Number(result.team1Score) : null,
      team2Score: result ? Number(result.team2Score) : null,
      scoreLine: result
        ? `${wickets(result.team1Score, result.team1Wickets)} — ${wickets(result.team2Score, result.team2Wickets)}`
        : '',
      outcome: !result
        ? 'Awaiting result'
        : result.result === 'Tie'
          ? 'Draw — both share'
          : result.result === 'NoResult'
            ? 'No result'
            : 'Decided',
      winningTeamName: result?.winningTeamId
        ? (lookupName('teams', result.winningTeamId, 'teamName') ?? null)
        : null,
      margin: (result?.margin as string | null) ?? null,
      resultMethod: (result?.resultMethod as string | null) ?? null,
      manOfTheMatchName: result?.manOfTheMatchPlayerId
        ? (lookupName('players', result.manOfTheMatchPlayerId, 'name') ?? null)
        : null,
      status: fixture.status as HistoryRow['status'],
    };
  });

  /* Standings for the same slice, so the ladder always matches the table
     above it rather than being the whole season's. */
  const teamIds = new Set<number>();
  for (const fixture of fixtures) {
    teamIds.add(Number(fixture.team1Id));
    teamIds.add(Number(fixture.team2Id));
  }

  const standings: StandingsRow[] = [...teamIds]
    .map((teamId) => {
      const team = findById('teams', teamId);
      const row: StandingsRow = {
        teamId,
        teamName: team ? String(team.teamName) : `#${teamId}`,
        teamCode: team ? String(team.teamCode) : '',
        subGroupName: team ? lookupName('subGroups', team.subGroupId, 'subGroupName') : undefined,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        noResult: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        points: 0,
      };

      for (const fixture of fixtures) {
        const isHome = Number(fixture.team1Id) === teamId;
        const isAway = Number(fixture.team2Id) === teamId;
        if (!isHome && !isAway) continue;
        const result = results.get(Number(fixture.scheduleId));
        if (!result) continue;

        row.played += 1;
        row.scoreFor += Number(isHome ? result.team1Score : result.team2Score);
        row.scoreAgainst += Number(isHome ? result.team2Score : result.team1Score);
        row.points += Number(isHome ? result.pointsTeam1 : result.pointsTeam2);

        if (result.result === 'Tie') row.drawn += 1;
        else if (result.result === 'NoResult') row.noResult += 1;
        else if (Number(result.winningTeamId) === teamId) row.won += 1;
        else row.lost += 1;
      }

      return row;
    })
    .filter((row) => row.played > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.scoreFor - b.scoreAgainst - (a.scoreFor - a.scoreAgainst) ||
        a.teamName.localeCompare(b.teamName),
    );

  return {
    rows,
    total: rows.length,
    summary: {
      played: rows.filter((r) => r.outcome !== 'Awaiting result').length,
      awaiting: rows.filter((r) => r.outcome === 'Awaiting result').length,
      decided: rows.filter((r) => r.outcome === 'Decided').length,
      drawn: rows.filter((r) => r.outcome === 'Draw — both share').length,
      noResult: rows.filter((r) => r.outcome === 'No result').length,
    },
    standings,
  };
}

/* ------------------------------------------------------------------ *
 * Export — produces a real downloadable file from the live dataset
 * ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: AnyRow[], columns: string[]): string {
  const head = columns.join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(','));
  return [head, ...body].join('\r\n');
}

function buildExport(request: ExportRequest): Blob {
  const { reportType, format, filters } = request;
  const scope = (subGroupId: unknown): boolean =>
    !filters.subGroupId || Number(subGroupId) === Number(filters.subGroupId);

  let rows: AnyRow[] = [];
  let columns: string[] = [];

  switch (reportType) {
    case 'playerMaster':
      rows = decorateAll('players', col('players').rows.filter((p) => scope(p.subGroupId)));
      columns = ['playerId', 'name', 'mobileNo', 'email', 'interest', 'subGroupName', 'playerSubTypeName', 'playerSubTypeDetailName', 'status', 'isActive'];
      break;
    /* Neither table carries a subGroupId of its own, so scope is resolved through the parent. */
    case 'teamRoster':
      rows = decorateAll(
        'teamAllocations',
        col('teamAllocations').rows.filter(
          (a) =>
            (!filters.teamId || Number(a.teamId) === Number(filters.teamId)) &&
            scope(findById('teams', Number(a.teamId))?.subGroupId),
        ),
      );
      columns = ['allocationId', 'teamName', 'playerName', 'jerseyNo', 'allocationDate', 'isActive'];
      break;
    case 'teamGroups':
      rows = decorateAll(
        'teamGroupDetails',
        col('teamGroupDetails').rows.filter((d) =>
          scope(findById('teamGroups', Number(d.teamGroupId))?.subGroupId),
        ),
      );
      columns = ['teamGroupDetailId', 'teamGroupName', 'teamName', 'isActive'];
      break;
    case 'matchSchedule':
      rows = decorateAll('schedules', col('schedules').rows.filter((s) => scope(s.subGroupId)));
      columns = ['matchNo', 'matchDate', 'matchTime', 'team1Name', 'team2Name', 'venue', 'oversPerInnings', 'status'];
      break;
    case 'rules':
      rows = decorateAll('ruleCards', col('ruleCards').rows.filter((r) => scope(r.subGroupId)));
      columns = ['ruleId', 'subGroupName', 'ruleTitle', 'version', 'effectiveDate', 'ruleBody'];
      break;
    /* These two take the viewer's own filter object, so the file is the exact
       slice that was on screen when the button was pressed. */
    case 'matchHistory':
      rows = buildHistory(filters as AnyRow).rows as unknown as AnyRow[];
      columns = [
        'matchNo', 'matchDate', 'matchTime', 'year', 'seasonName', 'eventCode', 'eventName',
        'subGroupName', 'venue', 'team1Name', 'team2Name', 'scoreLine', 'outcome',
        'winningTeamName', 'margin', 'resultMethod', 'manOfTheMatchName', 'status',
      ];
      break;
    case 'standings':
      rows = buildHistory(filters as AnyRow).standings as unknown as AnyRow[];
      columns = [
        'teamCode', 'teamName', 'subGroupName', 'played', 'won', 'drawn', 'lost',
        'noResult', 'scoreFor', 'scoreAgainst', 'points',
      ];
      break;
    case 'dashboardSnapshot': {
      const summary = buildDashboard(filters as AnyRow);
      rows = [
        { metric: 'Players', value: summary.players },
        { metric: 'Teams', value: summary.teams },
        { metric: 'Matches', value: summary.matches },
        { metric: 'Active users', value: summary.activeUsers },
        ...summary.registrationsBySubGroup.map((r) => ({ metric: `Registrations — ${r.label}`, value: r.value })),
        ...summary.scheduleStatus.map((r) => ({ metric: `Schedule — ${r.label}`, value: r.value })),
      ];
      columns = ['metric', 'value'];
      break;
    }
    default:
      throw new ApiError('Unknown report type.', 400);
  }

  log('Report', 0, 'Export', `${reportType} exported as ${format} (${rows.length} rows)`);

  const csv = toCsv(rows, columns);

  /* The mock produces CSV bytes for all three formats. A real API would return
     a genuine .xlsx or .pdf here; the download plumbing is identical. */
  if (format === 'PDF') {
    const text = `Corporate Premier League — ${reportType}\r\nGenerated ${new Date().toISOString()}\r\n\r\n${csv}`;
    return new Blob([text], { type: 'text/plain;charset=utf-8' });
  }
  return new Blob(['﻿', csv], {
    type: format === 'XLS' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8',
  });
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

export const mockTransport: Transport = async <T,>(spec: RequestSpec): Promise<T> => {
  await latency(spec.signal);

  const path = spec.path.replace(/\/+$/, '');
  const query = (spec.query ?? {}) as AnyRow;
  const payload = (spec.body ?? {}) as AnyRow;

  /* ---- auth ---- */
  if (path === '/token' || path === '/api/account/login') return handleLogin(spec) as T;

  if (path === '/api/account/logout') {
    const leaving = actor();
    if (leaving) log('UserAccount', leaving.userId, 'Logout', `${leaving.userName} signed out`);
    currentUser = null;
    return undefined as T;
  }

  if (path === '/api/account/me') {
    const me = actor();
    if (!me) throw new ApiError('Not signed in.', 401);
    return me as T;
  }

  if (path === '/api/account/forgot-password') {
    const exists = col('users').rows.some(
      (u) =>
        String(u.email).toLowerCase() === String(payload.email ?? '').toLowerCase() ||
        String(u.userName).toLowerCase() === String(payload.email ?? '').toLowerCase(),
    );
    /* Always reports success — never confirm whether an address is registered. */
    return { sent: true, hint: exists ? 'account-exists' : 'no-account' } as T;
  }

  if (path === '/api/account/reset-password') {
    if (!payload.token) throw new ApiError('Reset link is invalid or has expired.', 400, { token: 'Invalid token.' });
    return { reset: true } as T;
  }

  if (path === '/api/account/change-password') {
    if (payload.currentPassword !== DEMO_PASSWORD) {
      throw new ApiError('Your current password is incorrect.', 400, {
        currentPassword: 'Incorrect password.',
      });
    }
    return { changed: true } as T;
  }

  if (path === '/api/account/profile') {
    const me = actor();
    if (!me) throw new ApiError('Not signed in.', 401);
    const account = findById('users', me.userId);
    if (account) {
      account.displayName = String(payload.displayName ?? account.displayName);
      account.email = String(payload.email ?? account.email);
      currentUser = toAuthUser(account as unknown as UserAccount);
    }
    return currentUser as T;
  }

  /* ---- dashboard + reports ---- */
  if (path === '/api/dashboard/summary') return buildDashboard(query) as T;
  if (path === '/api/history') return buildHistory(query) as T;

  if (path === '/api/reports/export') return buildExport(spec.body as ExportRequest) as T;

  /* ---- bulk classification ---- */
  if (path === '/api/players/classify') {
    const ids = Array.isArray(payload.playerIds) ? (payload.playerIds as number[]) : [];
    if (!ids.length) {
      throw new ApiError('Select at least one participant first.', 400, {
        playerIds: 'Nothing selected.',
      });
    }

    /* Which level is being written decides what gets cleared below it. Only
       one level may travel per call — sending two would make the cascade
       ambiguous. */
    const levels = (['groupId', 'subGroupId', 'playerSubTypeId', 'playerSubTypeDetailId'] as const)
      .filter((key) => payload[key] !== undefined);
    if (levels.length !== 1) {
      throw new ApiError('Send exactly one classification level per call.', 400);
    }
    const level = levels[0]!;
    const value = payload[level] === null ? null : Number(payload[level]);

    /* Resolve the target up-front so a bad id fails before anything is written. */
    let interest: string | undefined;
    if (level === 'groupId' && value !== null) {
      const group = findById('groups', value);
      if (!group) throw new ApiError('That group no longer exists.', 404);
      if (!group.isActive) throw new ApiError(`${group.groupName} is inactive.`, 409);
      interest = String(group.groupName);
    }
    if (level === 'subGroupId' && value !== null) {
      const subGroup = findById('subGroups', value);
      if (!subGroup) throw new ApiError('That sub-group no longer exists.', 404);
      if (!subGroup.isActive) throw new ApiError(`${subGroup.subGroupName} is inactive.`, 409);
    }
    if (level === 'playerSubTypeId' && value !== null) {
      const type = findById('playerSubTypes', value);
      if (!type) throw new ApiError('That participant type no longer exists.', 404);
    }
    if (level === 'playerSubTypeDetailId' && value !== null) {
      const detail = findById('playerSubTypeDetails', value);
      if (!detail) throw new ApiError('That type detail no longer exists.', 404);
    }

    const skipped: { playerId: number; name: string; reason: string }[] = [];
    let updated = 0;

    for (const id of ids) {
      const row = findById('players', Number(id));
      if (!row) {
        skipped.push({ playerId: Number(id), name: `#${id}`, reason: 'No longer on the register' });
        continue;
      }
      if (!row.isActive) {
        skipped.push({ playerId: Number(id), name: String(row.name), reason: 'Inactive record' });
        continue;
      }

      /* A sub-group has to belong to the group the participant already sits in,
         otherwise the chain it produces is nonsense. */
      if (level === 'subGroupId' && value !== null) {
        const subGroup = findById('subGroups', value)!;
        const parent = findById('groups', Number(subGroup.groupId));
        if (parent && String(parent.groupName) !== String(row.interest)) {
          skipped.push({
            playerId: Number(row.playerId),
            name: String(row.name),
            reason: `In ${row.interest}, not ${parent.groupName}`,
          });
          continue;
        }
      }

      if (level === 'playerSubTypeId' && value !== null) {
        const type = findById('playerSubTypes', value)!;
        if (Number(type.subGroupId) !== Number(row.subGroupId)) {
          skipped.push({
            playerId: Number(row.playerId),
            name: String(row.name),
            reason: 'Type belongs to a different sub-group',
          });
          continue;
        }
      }

      if (level === 'playerSubTypeDetailId' && value !== null) {
        const detail = findById('playerSubTypeDetails', value)!;
        if (Number(detail.playerSubTypeId) !== Number(row.playerSubTypeId)) {
          skipped.push({
            playerId: Number(row.playerId),
            name: String(row.name),
            reason: 'Detail belongs to a different type',
          });
          continue;
        }
      }

      /* Write the level, then clear everything beneath it. */
      if (level === 'groupId') {
        row.interest = interest ?? 'None';
        row.subGroupId = null;
        row.playerSubTypeId = null;
        row.playerSubTypeDetailId = null;
      } else if (level === 'subGroupId') {
        row.subGroupId = value;
        row.playerSubTypeId = null;
        row.playerSubTypeDetailId = null;
      } else if (level === 'playerSubTypeId') {
        row.playerSubTypeId = value;
        row.playerSubTypeDetailId = null;
      } else {
        row.playerSubTypeDetailId = value;
      }

      row.modifiedBy = actorName();
      row.modifiedOn = new Date().toISOString();
      updated += 1;
    }

    if (updated) {
      const target =
        level === 'groupId'
          ? interest
          : level === 'subGroupId'
            ? lookupName('subGroups', value, 'subGroupName')
            : level === 'playerSubTypeId'
              ? lookupName('playerSubTypes', value, 'subTypeName')
              : lookupName('playerSubTypeDetails', value, 'detailName');

      log(
        'PlayerMaster',
        0,
        'Update',
        `Classified ${updated} participant${updated === 1 ? '' : 's'} → ${target ?? 'cleared'}`,
      );
    }

    return { updated, skipped } as T;
  }

  /* ---- generic CRUD ---- */
  const crud = /^\/api\/([a-z]+)(?:\/(\d+))?$/.exec(path);
  if (crud) {
    const name = ROUTES[crud[1]!];
    if (!name) throw new ApiError(`No mock route for ${path}.`, 404);

    const c = col(name);
    const id = crud[2] ? Number(crud[2]) : null;

    if (spec.method === 'GET') {
      if (id !== null) {
        const row = findById(name, id);
        if (!row) throw new ApiError('Record not found.', 404);
        return decorate(name, { ...row }) as T;
      }
      const result = queryCollection(c as never, query as never);
      return { ...result, items: decorateAll(name, result.items as AnyRow[]) } as T;
    }

    if (spec.method === 'POST') {
      applyConstraints(name, payload);
      const row: AnyRow = {
        isActive: true,
        ...payload,
        [c.idField]: nextId(c as never),
        createdBy: actorName(),
        createdOn: new Date().toISOString(),
      };
      c.rows.push(row);
      syncScheduleUmpires(name, row);
      log(entityLabel(name), Number(row[c.idField]), 'Create', describe(name, row));
      return decorate(name, { ...row }) as T;
    }

    if (spec.method === 'PUT' && id !== null) {
      const row = findById(name, id);
      if (!row) throw new ApiError('Record not found.', 404);
      applyConstraints(name, { ...row, ...payload }, id);

      /* Reactivation arrives as an ordinary PUT that flips isActive. Logging
         it as a generic Update buries the one event the trail exists to
         answer — who turned a deactivated record back on — among every other
         field edit, so it gets its own action. */
      const reactivated = row.isActive === false && payload.isActive === true;

      Object.assign(row, payload, {
        [c.idField]: id,
        modifiedBy: actorName(),
        modifiedOn: new Date().toISOString(),
      });
      syncScheduleUmpires(name, row);
      log(entityLabel(name), id, reactivated ? 'Activate' : 'Update', describe(name, row));
      return decorate(name, { ...row }) as T;
    }

    /* Constraint: soft delete only. The row stays, isActive flips. */
    if (spec.method === 'DELETE' && id !== null) {
      const row = findById(name, id);
      if (!row) throw new ApiError('Record not found.', 404);
      row.isActive = false;
      row.modifiedBy = actorName();
      row.modifiedOn = new Date().toISOString();
      log(entityLabel(name), id, 'Deactivate', describe(name, row));
      return decorate(name, { ...row }) as T;
    }
  }

  throw new ApiError(`No mock route for ${spec.method} ${path}.`, 404);
};

/** Keeps the umpire junction in step with the multi-select on the fixture form. */
function syncScheduleUmpires(name: CollectionName, row: AnyRow): void {
  if (name !== 'schedules') return;
  const scheduleId = Number(row.scheduleId);
  const wanted = (row.umpireIds as number[] | undefined) ?? [];
  const c = col('scheduleUmpires');
  c.rows = c.rows.filter((u) => Number(u.scheduleId) !== scheduleId);
  for (const umpireId of wanted) {
    c.rows.push({
      scheduleUmpireId: nextId(db.scheduleUmpires),
      scheduleId,
      umpireId,
      isActive: true,
      umpireName: lookupName('umpires', umpireId, 'umpireName'),
    });
  }
}

/**
 * What an audit entry calls the thing that changed.
 *
 * The collection keys are storage names — `playerSubTypeDetails`, `teamGroups`
 * — and an admin reading the trail should not have to translate them back into
 * the screens they came from. The value is what the API's own entity is
 * called, so the trail also lines up with the ASP.NET side.
 */
const ENTITY_LABELS: Partial<Record<CollectionName, string>> = {
  players: 'Participant',
  groups: 'Group',
  subGroups: 'Sub-group',
  playerSubTypes: 'Participant type',
  playerSubTypeDetails: 'Type detail',
  ruleCards: 'Rule card',
  teams: 'Team',
  formations: 'Team formation',
  teamAllocations: 'Team allocation',
  teamGroups: 'Team group',
  teamGroupDetails: 'Team group member',
  schedules: 'Fixture',
  matchResults: 'Match result',
  events: 'Event',
  seasons: 'Season',
  users: 'User account',
  rolePermissions: 'Role rights',
  umpires: 'Official',
  eventTeam: 'Event team member',
};

export const entityLabel = (name: CollectionName): string => ENTITY_LABELS[name] ?? name;

function describe(name: CollectionName, row: AnyRow): string {
  const label =
    row.name ?? row.teamName ?? row.formationName ?? row.groupName ?? row.subGroupName ??
    row.matchNo ?? row.ruleTitle ?? row.memberName ?? row.userName ?? row.umpireName ??
    row.eventName ?? row.detailName ?? row.subTypeName ?? row.umpireName ??
    row[col(name).idField];
  return String(label);
}

export { resetDb };
