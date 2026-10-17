import type {
  AuditLog,
  EventMaster,
  EventTeamMaster,
  GroupMaster,
  MatchResult,
  PlayerMaster,
  PlayerSubTypeDetail,
  PlayerSubTypeMaster,
  RolePermission,
  RuleCard,
  ScheduleMaster,
  ScheduleUmpireDetail,
  SeasonMaster,
  SubGroupMaster,
  TeamAllocation,
  TeamGroupDetail,
  TeamGroupMaster,
  TeamFormation,
  TeamMaster,
  UmpireMaster,
  UserAccount,
} from '../types';

/**
 * A complete, internally consistent season, generated deterministically.
 *
 * The generator is seeded so every reload produces byte-identical data — which
 * matters because otherwise a "player count" in a screenshot would drift, and
 * because reproducible fixtures make UI bugs reproducible too.
 */

/* mulberry32 — small, fast, and stable across engines. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260918);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));

const FIRST = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Krishna', 'Ishaan',
  'Rudra', 'Kabir', 'Anaya', 'Diya', 'Saanvi', 'Aadhya', 'Kiara', 'Myra',
  'Riya', 'Prisha', 'Ananya', 'Meera', 'Rohan', 'Karan', 'Nikhil', 'Rahul',
  'Siddharth', 'Manav', 'Devansh', 'Yash', 'Harsh', 'Parth', 'Neha', 'Pooja',
  'Sneha', 'Kavya', 'Isha', 'Tanvi', 'Shreya', 'Aditi', 'Nandini', 'Gauri',
] as const;

const LAST = [
  'Shah', 'Patel', 'Desai', 'Mehta', 'Joshi', 'Trivedi', 'Bhatt', 'Vyas',
  'Parikh', 'Chauhan', 'Solanki', 'Rana', 'Thakkar', 'Gandhi', 'Modi', 'Amin',
  'Pandya', 'Raval', 'Dave', 'Shukla',
] as const;

const DEPARTMENTS = [
  'Operations', 'Quality Control', 'R&D', 'Supply Chain', 'Finance',
  'Human Resources', 'Maintenance', 'Sales & Marketing', 'EHS', 'IT',
] as const;

const today = new Date('2026-09-18T00:00:00Z');
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const shift = (days: number): string => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

const audit = { isActive: true, createdBy: 'system', createdOn: shift(-180) };

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

export const seasons: SeasonMaster[] = [
  { ...audit, seasonId: 1, seasonName: 'Season 2025', year: 2025 },
  { ...audit, seasonId: 2, seasonName: 'Season 2026', year: 2026 },
];

/**
 * The league itself spans every group, so its scope is left open. The two
 * one-off events below are pinned, which is what gives the scheduling screens
 * something to narrow against.
 */
export const events: EventMaster[] = [
  {
    ...audit, eventId: 1, eventCode: 'CPL-2025', eventName: 'Corporate Premier League 2025', seasonId: 1,
    groupId: null, subGroupId: null,
    startDate: '2025-09-01', endDate: '2025-12-15', isCurrent: false, seasonName: 'Season 2025',
  },
  {
    ...audit, eventId: 2, eventCode: 'CPL-2026', eventName: 'Corporate Premier League 2026', seasonId: 2,
    groupId: null, subGroupId: null,
    startDate: '2026-09-01', endDate: '2026-12-20', isCurrent: true, seasonName: 'Season 2026',
  },
  {
    ...audit, eventId: 3, eventCode: 'CRK-CUP-26', eventName: 'Founders Cricket Cup 2026', seasonId: 2,
    groupId: 1, subGroupId: 1,
    startDate: '2026-10-05', endDate: '2026-10-25', isCurrent: false, seasonName: 'Season 2026',
  },
  {
    ...audit, eventId: 4, eventCode: 'CUL-FEST-26', eventName: 'Annual Cultural Festival 2026', seasonId: 2,
    groupId: 2, subGroupId: null,
    startDate: '2026-11-02', endDate: '2026-11-09', isCurrent: false, seasonName: 'Season 2026',
  },
];

export const CURRENT_EVENT_ID = 2;

export const groups: GroupMaster[] = [
  { ...audit, groupId: 1, groupName: 'Sports', description: 'Competitive sporting events', displayOrder: 1 },
  { ...audit, groupId: 2, groupName: 'Cultural', description: 'The festival of creation', displayOrder: 2 },
  { ...audit, groupId: 3, groupName: 'None', description: 'Registered interest, no sub-group', displayOrder: 3 },
];

export const subGroups: SubGroupMaster[] = [
  { ...audit, subGroupId: 1, groupId: 1, subGroupName: 'Cricket', displayOrder: 1, groupName: 'Sports' },
  { ...audit, subGroupId: 2, groupId: 1, subGroupName: 'Football', displayOrder: 2, groupName: 'Sports' },
  { ...audit, subGroupId: 3, groupId: 2, subGroupName: 'Cultural-1', displayOrder: 3, groupName: 'Cultural' },
  { ...audit, subGroupId: 4, groupId: 2, subGroupName: 'Cultural-2', displayOrder: 4, groupName: 'Cultural' },
];

export const playerSubTypes: PlayerSubTypeMaster[] = [
  { ...audit, playerSubTypeId: 1, subGroupId: 1, subTypeName: 'Batsman', displayOrder: 1, subGroupName: 'Cricket' },
  { ...audit, playerSubTypeId: 2, subGroupId: 1, subTypeName: 'Bowler', displayOrder: 2, subGroupName: 'Cricket' },
  { ...audit, playerSubTypeId: 3, subGroupId: 1, subTypeName: 'Wicket-keeper', displayOrder: 3, subGroupName: 'Cricket' },
  { ...audit, playerSubTypeId: 4, subGroupId: 1, subTypeName: 'Other support', displayOrder: 4, subGroupName: 'Cricket' },
  { ...audit, playerSubTypeId: 5, subGroupId: 2, subTypeName: 'Goalkeeper', displayOrder: 1, subGroupName: 'Football' },
  { ...audit, playerSubTypeId: 6, subGroupId: 2, subTypeName: 'Defender', displayOrder: 2, subGroupName: 'Football' },
  { ...audit, playerSubTypeId: 7, subGroupId: 2, subTypeName: 'Midfielder', displayOrder: 3, subGroupName: 'Football' },
  { ...audit, playerSubTypeId: 8, subGroupId: 2, subTypeName: 'Forward', displayOrder: 4, subGroupName: 'Football' },
];

export const playerSubTypeDetails: PlayerSubTypeDetail[] = [
  { ...audit, playerSubTypeDetailId: 1, playerSubTypeId: 2, detailName: 'Spin', displayOrder: 1, playerSubTypeName: 'Bowler' },
  { ...audit, playerSubTypeDetailId: 2, playerSubTypeId: 2, detailName: 'Pace', displayOrder: 2, playerSubTypeName: 'Bowler' },
  { ...audit, playerSubTypeDetailId: 3, playerSubTypeId: 2, detailName: 'Medium', displayOrder: 3, playerSubTypeName: 'Bowler' },
  { ...audit, playerSubTypeDetailId: 4, playerSubTypeId: 1, detailName: 'Opener', displayOrder: 1, playerSubTypeName: 'Batsman' },
  { ...audit, playerSubTypeDetailId: 5, playerSubTypeId: 1, detailName: 'Middle order', displayOrder: 2, playerSubTypeName: 'Batsman' },
  { ...audit, playerSubTypeDetailId: 6, playerSubTypeId: 1, detailName: 'Finisher', displayOrder: 3, playerSubTypeName: 'Batsman' },
];

export const ruleCards: RuleCard[] = [
  {
    ...audit, ruleId: 1, subGroupId: 1, ruleTitle: 'Cricket — Playing Conditions 2026',
    ruleBody:
      '1. Each innings is limited to the overs configured on the fixture.\n' +
      '2. A bowler may bowl no more than one fifth of the total overs.\n' +
      '3. Two fielders only outside the circle in the first six overs.\n' +
      '4. A player may represent exactly one team for the whole season.\n' +
      '5. Any player not on the roster at the group stage is ineligible for knockouts.',
    effectiveDate: '2026-09-01', version: 'v1.2', subGroupName: 'Cricket',
  },
  {
    ...audit, ruleId: 2, subGroupId: 2, ruleTitle: 'Football — Playing Conditions 2026',
    ruleBody:
      '1. Two halves of 25 minutes with a 5 minute interval.\n' +
      '2. Rolling substitutions, maximum of seven per side.\n' +
      '3. Two yellow cards in a match carry a one-fixture suspension.\n' +
      '4. Group ties are separated on goal difference, then goals scored.',
    effectiveDate: '2026-09-01', version: 'v1.0', subGroupName: 'Football',
  },
  {
    ...audit, ruleId: 3, subGroupId: 3, ruleTitle: 'Cultural-1 — Participation Guidelines',
    ruleBody:
      '1. Entries are individual unless the brief states otherwise.\n' +
      '2. All work must be original and produced within the festival window.\n' +
      '3. Judging is blind; entries carry a code, not a name.',
    effectiveDate: '2026-09-01', version: 'v1.0', subGroupName: 'Cultural-1',
  },
];

export const umpires: UmpireMaster[] = [
  { ...audit, umpireId: 1, umpireName: 'Daniel Foster', contactNo: '+91 90000 11223', email: 'daniel.foster@example.com', accreditationLevel: 'Certified Level 2', subGroupId: 1, subGroupName: 'Cricket' },
  { ...audit, umpireId: 2, umpireName: 'Marcus Webb', contactNo: '+91 90000 33445', email: 'marcus.webb@example.com', accreditationLevel: 'Certified Level 1', subGroupId: 1, subGroupName: 'Cricket' },
  { ...audit, umpireId: 3, umpireName: 'Peter Lang', contactNo: '+91 90000 55667', email: 'peter.lang@example.com', accreditationLevel: 'Regional Panel', subGroupId: 1, subGroupName: 'Cricket' },
  { ...audit, umpireId: 4, umpireName: 'Omar Haddad', contactNo: '+91 90000 77889', email: 'omar.haddad@example.com', accreditationLevel: 'Football C Licence', subGroupId: 2, subGroupName: 'Football' },
  { ...audit, umpireId: 5, umpireName: 'Victor Reyes', contactNo: '+91 90000 99001', email: 'victor.reyes@example.com', accreditationLevel: 'Football D Licence', subGroupId: 2, subGroupName: 'Football' },
  { ...audit, umpireId: 6, umpireName: 'Gareth Doyle', contactNo: '+91 90000 22334', email: 'gareth.doyle@example.com', accreditationLevel: 'Club Panel', subGroupId: null, subGroupName: undefined },
];

/* ------------------------------------------------------------------ *
 * Teams
 * ------------------------------------------------------------------ */

const TEAM_NAMES: Record<number, { name: string; code: string; color: string }[]> = {
  1: [
    { name: 'Magenta Riders', code: 'MAR', color: '#C72D86' },
    { name: 'Emerald Panthers', code: 'EMP', color: '#00A170' },
    { name: 'Solar Hunters', code: 'SOH', color: '#A88500' },
    { name: 'Azure United', code: 'AZU', color: '#2475B7' },
    { name: 'Crimson Vipers', code: 'CRV', color: '#DB55A5' },
    { name: 'Cobalt Chargers', code: 'COB', color: '#4A96D1' },
    { name: 'Amber Outlaws', code: 'AMO', color: '#D9AC00' },
    { name: 'Jade Vanguard', code: 'JAV', color: '#22BC8A' },
  ],
  2: [
    { name: 'Magenta FC', code: 'MFC', color: '#C72D86' },
    { name: 'Azure Athletic', code: 'AZA', color: '#2475B7' },
    { name: 'Solar Strikers', code: 'SOL', color: '#A88500' },
    { name: 'Emerald Eagles', code: 'EME', color: '#00A170' },
    { name: 'Crimson Colts', code: 'CRI', color: '#DB55A5' },
    { name: 'Indigo Ironsides', code: 'IND', color: '#4A96D1' },
    { name: 'Amber Arrows', code: 'AMB', color: '#D9AC00' },
    { name: 'Jade Juggernauts', code: 'JAD', color: '#22BC8A' },
  ],
  3: [
    { name: 'Atelier One', code: 'AT1', color: '#C72D86' },
    { name: 'Atelier Two', code: 'AT2', color: '#2475B7' },
    { name: 'Atelier Three', code: 'AT3', color: '#A88500' },
    { name: 'Atelier Four', code: 'AT4', color: '#00A170' },
  ],
  4: [
    { name: 'Studio Alpha', code: 'SAL', color: '#C72D86' },
    { name: 'Studio Beta', code: 'SBE', color: '#2475B7' },
    { name: 'Studio Gamma', code: 'SGA', color: '#A88500' },
    { name: 'Studio Delta', code: 'SDE', color: '#00A170' },
  ],
};

/* ------------------------------------------------------------------ *
 * Team formations — the shape each sub-group's squads are built to
 * ------------------------------------------------------------------ */

export const formations: TeamFormation[] = [
  {
    ...audit,
    formationId: 1,
    subGroupId: 1,
    subGroupName: 'Cricket',
    formationCode: 'CRK-XI',
    formationName: 'Standard XI',
    minPlayers: 11,
    maxPlayers: 12,
    slots: [
      { playerSubTypeId: 1, playerSubTypeName: 'Batsman', min: 3, max: 5 },
      { playerSubTypeId: 2, playerSubTypeName: 'Bowler', min: 3, max: 4 },
      { playerSubTypeId: 3, playerSubTypeName: 'Wicket-keeper', min: 1, max: 2 },
      { playerSubTypeId: 4, playerSubTypeName: 'Other support', min: 0, max: 1 },
    ],
  },
  {
    ...audit,
    formationId: 2,
    subGroupId: 2,
    subGroupName: 'Football',
    formationCode: 'FB-442',
    formationName: '4-4-2',
    minPlayers: 11,
    maxPlayers: 14,
    slots: [
      { playerSubTypeId: 5, playerSubTypeName: 'Goalkeeper', min: 1, max: 2 },
      { playerSubTypeId: 6, playerSubTypeName: 'Defender', min: 4, max: 5 },
      { playerSubTypeId: 7, playerSubTypeName: 'Midfielder', min: 4, max: 5 },
      { playerSubTypeId: 8, playerSubTypeName: 'Forward', min: 2, max: 2 },
    ],
  },
];

export const teams: TeamMaster[] = [];
{
  let teamId = 1;
  for (const subGroupId of [1, 2, 3, 4]) {
    const subGroupName = subGroups.find((s) => s.subGroupId === subGroupId)!.subGroupName;
    const formation = formations.find((f) => f.subGroupId === subGroupId);
    for (const t of TEAM_NAMES[subGroupId] ?? []) {
      teams.push({
        ...audit,
        teamId: teamId++,
        subGroupId,
        teamName: t.name,
        teamCode: t.code,
        maxPlayers: formation?.maxPlayers ?? 8,
        eventId: CURRENT_EVENT_ID,
        captainPlayerId: null,
        colorHex: t.color,
        formationId: formation?.formationId ?? null,
        formationName: formation?.formationName,
        subGroupName,
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * Players — 284, distributed to match the blueprint's dashboard
 * ------------------------------------------------------------------ */

const DISTRIBUTION: { subGroupId: number | null; interest: 'Sports' | 'Cultural' | 'None'; count: number }[] = [
  { subGroupId: 1, interest: 'Sports', count: 142 },
  { subGroupId: 2, interest: 'Sports', count: 88 },
  { subGroupId: 3, interest: 'Cultural', count: 36 },
  { subGroupId: 4, interest: 'Cultural', count: 18 },
];

export const players: PlayerMaster[] = [];
{
  let playerId = 1;
  const used = new Set<string>();

  for (const bucket of DISTRIBUTION) {
    for (let i = 0; i < bucket.count; i += 1) {
      let name = `${pick(FIRST)} ${pick(LAST)}`;
      let guard = 0;
      while (used.has(name) && guard < 50) {
        name = `${pick(FIRST)} ${pick(LAST)}`;
        guard += 1;
      }
      used.add(name);

      const slug = name.toLowerCase().replace(/\s+/g, '.');
      const subTypes = playerSubTypes.filter((t) => t.subGroupId === bucket.subGroupId);
      const subType = subTypes.length ? pick(subTypes) : null;
      const details = subType
        ? playerSubTypeDetails.filter((d) => d.playerSubTypeId === subType.playerSubTypeId)
        : [];
      const detail = details.length ? pick(details) : null;

      /* Most are activated; a realistic tail sits pending or rejected. */
      const roll = rand();
      const status = roll > 0.97 ? 'Rejected' : roll > 0.92 ? 'Pending' : 'Active';

      players.push({
        ...audit,
        playerId: playerId++,
        name,
        mobileNo: `+91 9${between(1000000000, 1999999999)}`.slice(0, 17),
        whatsAppNo: rand() > 0.35 ? `+91 9${between(1000000000, 1999999999)}`.slice(0, 17) : undefined,
        email: `${slug}${playerId}@example.com`,
        interest: bucket.interest,
        subGroupId: bucket.subGroupId,
        playerSubTypeId: subType?.playerSubTypeId ?? null,
        playerSubTypeDetailId: detail?.playerSubTypeDetailId ?? null,
        eventId: CURRENT_EVENT_ID,
        status: status as PlayerMaster['status'],
        dateOfBirth: `${between(1978, 2004)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
        gender: rand() > 0.28 ? 'Male' : 'Female',
        employeeCode: `ACE-${String(between(1000, 9999))}`,
        department: pick(DEPARTMENTS),
        emergencyContactName: `${pick(FIRST)} ${pick(LAST)}`,
        emergencyContactNo: `+91 9${between(1000000000, 1999999999)}`.slice(0, 17),
        tShirtSize: pick(['S', 'M', 'L', 'XL', 'XXL'] as const),
        registeredOn: shift(-between(1, 56)),
        subGroupName: subGroups.find((s) => s.subGroupId === bucket.subGroupId)?.subGroupName,
        playerSubTypeName: subType?.subTypeName,
        playerSubTypeDetailName: detail?.detailName,
      });
    }
  }

  /* A handful of "None" registrations, to exercise the skip branch. */
  for (let i = 0; i < 6; i += 1) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    players.push({
      ...audit,
      playerId: playerId++,
      name,
      mobileNo: `+91 9${between(1000000000, 1999999999)}`.slice(0, 17),
      email: `${name.toLowerCase().replace(/\s+/g, '.')}${playerId}@example.com`,
      interest: 'None',
      subGroupId: null,
      playerSubTypeId: null,
      playerSubTypeDetailId: null,
      eventId: CURRENT_EVENT_ID,
      status: 'Pending',
      department: pick(DEPARTMENTS),
      registeredOn: shift(-between(1, 20)),
    });
  }
}

/* ------------------------------------------------------------------ *
 * Allocations — respects capacity and one-active-team-per-player
 * ------------------------------------------------------------------ */

export const teamAllocations: TeamAllocation[] = [];
{
  let allocationId = 1;
  const allocated = new Set<number>();

  for (const team of teams) {
    const eligible = players.filter(
      (p) =>
        p.subGroupId === team.subGroupId &&
        p.status === 'Active' &&
        !allocated.has(p.playerId),
    );
    /* Leave a couple of teams short so the fill meter has something to say. */
    const target = rand() > 0.78 ? team.maxPlayers - between(1, 3) : team.maxPlayers;
    const formation = formations.find((f) => f.formationId === team.formationId);

    /**
     * Squads are filled BY TYPE, not by whoever comes first in the list.
     *
     * Taking the first N eligible produced rosters that broke their own
     * formation — four keepers in a side that allows two — which the squad
     * builder then had to render as an over-full slot. Demo data that cannot
     * satisfy its own rules is worse than no demo data, because every screen
     * downstream inherits the contradiction.
     */
    const picked: typeof eligible = [];
    const take = (typeId: number, count: number) => {
      const ofType = eligible.filter(
        (p) => p.playerSubTypeId === typeId && !allocated.has(p.playerId),
      );
      for (const p of ofType.slice(0, Math.max(0, count))) {
        allocated.add(p.playerId);
        picked.push(p);
      }
    };

    if (formation) {
      /* Floors first, so no type is starved by a greedy earlier one. */
      for (const slot of formation.slots) take(slot.playerSubTypeId, slot.min);

      /* Then top up toward the target, never past a type's ceiling. */
      for (const slot of formation.slots) {
        if (picked.length >= target) break;
        const already = picked.filter(
          (p) => p.playerSubTypeId === slot.playerSubTypeId,
        ).length;
        take(slot.playerSubTypeId, Math.min(slot.max - already, target - picked.length));
      }
    } else {
      /* Sub-groups with no formation (Cultural) keep the simple fill. */
      for (const p of eligible.slice(0, Math.max(0, target))) {
        allocated.add(p.playerId);
        picked.push(p);
      }
    }

    for (const player of picked) {
      teamAllocations.push({
        ...audit,
        allocationId: allocationId++,
        playerId: player.playerId,
        teamId: team.teamId,
        eventId: CURRENT_EVENT_ID,
        allocationDate: shift(-between(5, 40)),
        jerseyNo: between(1, 99),
        playerName: player.name,
        teamName: team.teamName,
      });
    }
  }

  /* Give each team a captain from its own roster. */
  for (const team of teams) {
    const roster = teamAllocations.filter((a) => a.teamId === team.teamId);
    if (roster.length) team.captainPlayerId = roster[0]!.playerId;
    team.allocatedCount = roster.length;
  }
}

/* ------------------------------------------------------------------ *
 * Competition groups
 * ------------------------------------------------------------------ */

export const teamGroups: TeamGroupMaster[] = [];
export const teamGroupDetails: TeamGroupDetail[] = [];
{
  let teamGroupId = 1;
  let detailId = 1;

  for (const subGroup of subGroups) {
    const subTeams = teams.filter((t) => t.subGroupId === subGroup.subGroupId);
    if (subTeams.length < 2) continue;

    const half = Math.ceil(subTeams.length / 2);
    for (const [index, label] of ['Group A', 'Group B'].entries()) {
      const members = index === 0 ? subTeams.slice(0, half) : subTeams.slice(half);
      if (!members.length) continue;

      const group: TeamGroupMaster = {
        ...audit,
        teamGroupId: teamGroupId++,
        subGroupId: subGroup.subGroupId,
        groupName: label,
        eventId: CURRENT_EVENT_ID,
        subGroupName: subGroup.subGroupName,
        teamCount: members.length,
      };
      teamGroups.push(group);

      for (const team of members) {
        teamGroupDetails.push({
          ...audit,
          teamGroupDetailId: detailId++,
          teamGroupId: group.teamGroupId,
          teamId: team.teamId,
          teamName: team.teamName,
          teamGroupName: `${subGroup.subGroupName} — ${label}`,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Fixtures — round-robin inside each competition group
 * ------------------------------------------------------------------ */

export const schedules: ScheduleMaster[] = [];
export const scheduleUmpires: ScheduleUmpireDetail[] = [];
export const matchResults: MatchResult[] = [];
{
  let scheduleId = 1;
  let scheduleUmpireId = 1;
  let matchResultId = 1;
  const slots = ['09:00', '14:00'];

  /* Round-robin inside each competition group. Built first, then interleaved
     across groups and dated around today — otherwise the loop would give every
     cricket fixture to the past and every Cultural fixture to the future, and the
     dashboard would show a season that is either entirely over or entirely
     ahead of itself. */
  const pairings = teamGroups.map((group) => {
    const memberIds = teamGroupDetails
      .filter((d) => d.teamGroupId === group.teamGroupId)
      .map((d) => d.teamId);

    const rounds: { group: TeamGroupMaster; team1Id: number; team2Id: number }[] = [];
    for (let i = 0; i < memberIds.length; i += 1) {
      for (let j = i + 1; j < memberIds.length; j += 1) {
        rounds.push({ group, team1Id: memberIds[i]!, team2Id: memberIds[j]! });
      }
    }
    return rounds;
  });

  const ordered: { group: TeamGroupMaster; team1Id: number; team2Id: number }[] = [];
  const longest = Math.max(0, ...pairings.map((p) => p.length));
  for (let round = 0; round < longest; round += 1) {
    for (const list of pairings) {
      const fixture = list[round];
      if (fixture) ordered.push(fixture);
    }
  }

  /* Two fixtures a day, starting ten days ago — so roughly two thirds of the
     season is played and the rest is still to come. */
  const FIRST_DAY = -10;

  ordered.forEach((pairing, index) => {
    const { group, team1Id, team2Id } = pairing;
    const team1 = teams.find((t) => t.teamId === team1Id)!;
    const team2 = teams.find((t) => t.teamId === team2Id)!;

    const dayOffset = FIRST_DAY + Math.floor(index / slots.length);
    const matchDate = shift(dayOffset);
    const isPast = dayOffset < 0;
    const status: ScheduleMaster['status'] = isPast
      ? 'Completed'
      : rand() > 0.7
        ? 'Pending'
        : 'Scheduled';

    const officials = umpires
      .filter((u) => u.subGroupId === group.subGroupId || u.subGroupId === null)
      .slice(0, 2);

    const fixture: ScheduleMaster = {
      ...audit,
      scheduleId,
      matchNo: `M-${String(scheduleId).padStart(3, '0')}`,
      matchDate,
      matchTime: slots[index % slots.length]!,
      team1Id,
      team2Id,
      subGroupId: group.subGroupId,
      eventId: CURRENT_EVENT_ID,
      oversPerInnings: group.subGroupId === 1 ? 12 : null,
      venue: group.subGroupId === 2 ? 'Ground B' : 'Ground A',
      status,
      umpireIds: officials.map((u) => u.umpireId),
      team1Name: team1.teamName,
      team2Name: team2.teamName,
      subGroupName: group.subGroupName,
    };
    schedules.push(fixture);

    for (const official of officials) {
      scheduleUmpires.push({
        ...audit,
        scheduleUmpireId: scheduleUmpireId++,
        scheduleId,
        umpireId: official.umpireId,
        umpireName: official.umpireName,
      });
    }

    if (status === 'Completed') {
      const cricket = group.subGroupId === 1;
      const s1 = cricket ? between(68, 164) : between(0, 5);
      const s2 = cricket ? between(68, 164) : between(0, 5);
      const tie = s1 === s2;
      const winnerId = tie ? null : s1 > s2 ? team1Id : team2Id;

      /* Awards are drawn from the winning squad where there is one, so the
         seeded data reads the way real data would rather than handing the
         medal to someone who was not playing. */
      const squad = teamAllocations.filter(
        (a) => a.teamId === (winnerId ?? team1Id) && a.isActive,
      );
      const pick = (offset: number) =>
        squad.length ? (squad[(offset * 3) % squad.length]!.playerId ?? null) : null;

      matchResults.push({
        ...audit,
        matchResultId: matchResultId++,
        scheduleId,
        team1Score: s1,
        team1Wickets: cricket ? between(2, 10) : null,
        team2Score: s2,
        team2Wickets: cricket ? between(2, 10) : null,
        oversBowled: fixture.oversPerInnings ?? null,
        result: tie ? 'Tie' : 'Win',
        winningTeamId: winnerId,
        resultMethod: tie ? null : cricket ? 'Runs' : 'Goals',
        margin: tie
          ? 'Scores level'
          : `${Math.abs(s1 - s2)} ${cricket ? 'runs' : Math.abs(s1 - s2) === 1 ? 'goal' : 'goals'}`,
        pointsTeam1: tie ? 1 : s1 > s2 ? 2 : 0,
        pointsTeam2: tie ? 1 : s2 > s1 ? 2 : 0,
        tossWonByTeamId: rand() > 0.5 ? team1Id : team2Id,
        tossDecision: rand() > 0.5 ? 'Bat' : 'Bowl',
        manOfTheMatchPlayerId: pick(index),
        bestBatsmanPlayerId: cricket ? pick(index + 1) : null,
        bestBowlerPlayerId: cricket ? pick(index + 2) : null,
        matchNo: fixture.matchNo,
      });
    }

    scheduleId += 1;
  });
}

/* ------------------------------------------------------------------ *
 * People who run the thing
 * ------------------------------------------------------------------ */

export const eventTeam: EventTeamMaster[] = [
  { ...audit, eventTeamId: 1, memberName: 'Chris Morgan', contactNo: '+91 90000 10101', email: 'chris.morgan@example.com', role: 'Moderator', subGroupId: 1, eventId: CURRENT_EVENT_ID, subGroupName: 'Cricket' },
  { ...audit, eventTeamId: 2, memberName: 'Hannah Brooks', contactNo: '+91 90000 20202', email: 'hannah.brooks@example.com', role: 'CoModerator', subGroupId: 1, eventId: CURRENT_EVENT_ID, subGroupName: 'Cricket' },
  { ...audit, eventTeamId: 3, memberName: 'Tom Ellis', contactNo: '+91 90000 30303', email: 'tom.ellis@example.com', role: 'Timekeeper', subGroupId: 1, eventId: CURRENT_EVENT_ID, subGroupName: 'Cricket' },
  { ...audit, eventTeamId: 4, memberName: 'Ravi Kapoor', contactNo: '+91 90000 40404', email: 'ravi.kapoor@example.com', role: 'Moderator', subGroupId: 2, eventId: CURRENT_EVENT_ID, subGroupName: 'Football' },
  { ...audit, eventTeamId: 5, memberName: 'Sara Whitman', contactNo: '+91 90000 50505', email: 'sara.whitman@example.com', role: 'Member', subGroupId: 2, eventId: CURRENT_EVENT_ID, subGroupName: 'Football' },
  { ...audit, eventTeamId: 6, memberName: 'Elena Rossi', contactNo: '+91 90000 60606', email: 'elena.rossi@example.com', role: 'Moderator', subGroupId: 3, eventId: CURRENT_EVENT_ID, subGroupName: 'Cultural-1' },
];

export const users: UserAccount[] = [
  { ...audit, userId: 1, userName: 'admin', email: 'jordan.blake@example.com', displayName: 'Jordan Blake', role: 'MainAdmin', subGroupId: null, lastLoginOn: shift(-1) },
  { ...audit, userId: 2, userName: 'cricket', email: 'chris.morgan@example.com', displayName: 'Chris Morgan', role: 'ManagementTeam', subGroupId: 1, lastLoginOn: shift(-2), subGroupName: 'Cricket' },
  { ...audit, userId: 3, userName: 'football', email: 'ravi.kapoor@example.com', displayName: 'Ravi Kapoor', role: 'ManagementTeam', subGroupId: 2, lastLoginOn: shift(-3), subGroupName: 'Football' },
  { ...audit, userId: 4, userName: 'cultural', email: 'elena.rossi@example.com', displayName: 'Elena Rossi', role: 'ManagementTeam', subGroupId: 3, lastLoginOn: shift(-6), subGroupName: 'Cultural-1' },
  { ...audit, userId: 5, userName: 'events', email: 'hannah.brooks@example.com', displayName: 'Hannah Brooks', role: 'EventManagement', subGroupId: 1, lastLoginOn: shift(-1), subGroupName: 'Cricket' },
  { ...audit, userId: 6, userName: 'events-fb', email: 'sara.whitman@example.com', displayName: 'Sara Whitman', role: 'EventManagement', subGroupId: 2, lastLoginOn: shift(-4), subGroupName: 'Football' },
  { ...audit, userId: 7, userName: 'archive', email: 'archive@example.com', displayName: 'Archive Account', role: 'ManagementTeam', subGroupId: 4, isActive: false, subGroupName: 'Cultural-2' },
];

const full = { view: true, create: true, edit: true, deactivate: true };
const viewOnly = { view: true, create: false, edit: false, deactivate: false };
const viewEdit = { view: true, create: false, edit: true, deactivate: false };
const no = { view: false, create: false, edit: false, deactivate: false };

/**
 * Mirrors src/rbac/matrix.ts. The matrix is what the interface reads; these
 * rows are what the Role rights screen edits and what the server would send.
 * They are seeded identical on purpose — if they drift, the rights screen is
 * lying about what the app will actually do.
 */
export const rolePermissions: RolePermission[] = [
  {
    ...audit, rolePermissionId: 1, roleName: 'MainAdmin', scopeType: 'Global',
    permissions: {
      dashboard: full, participants: full, integration: full, masters: full,
      teams: full, formations: full, teamBuilder: full, allocation: full, teamGroups: full,
      events: full, schedule: full, results: full, rules: full,
      users: full, permissions: full, audit: full, exports: full,
    },
  },
  {
    ...audit, rolePermissionId: 2, roleName: 'ManagementTeam', scopeType: 'SubGroup',
    permissions: {
      dashboard: viewOnly, participants: viewEdit, integration: full, masters: viewOnly,
      teams: full, formations: viewOnly, teamBuilder: full, allocation: full, teamGroups: full,
      events: viewOnly, schedule: viewOnly, results: no, rules: viewOnly,
      users: no, permissions: no, audit: no, exports: viewOnly,
    },
  },
  {
    ...audit, rolePermissionId: 3, roleName: 'EventManagement', scopeType: 'SubGroup',
    permissions: {
      dashboard: viewOnly, participants: viewOnly, integration: no, masters: viewOnly,
      teams: viewOnly, formations: viewOnly, teamBuilder: no, allocation: viewOnly, teamGroups: viewOnly,
      events: viewEdit, schedule: full, results: full, rules: full,
      users: no, permissions: no, audit: no, exports: viewOnly,
    },
  },
];

export const auditLogs: AuditLog[] = [
  { auditId: 1, entityName: 'ScheduleMaster', entityId: 12, action: 'Update', userName: 'cricket', timestamp: `${shift(-1)}T11:04:00Z`, details: 'Match time moved 09:00 -> 11:30' },
  { auditId: 2, entityName: 'TeamAllocation', entityId: 88, action: 'Create', userName: 'cricket', timestamp: `${shift(-1)}T10:41:00Z`, details: 'Player allocated to Magenta Riders' },
  { auditId: 3, entityName: 'PlayerMaster', entityId: 271, action: 'Activate', userName: 'admin', timestamp: `${shift(-2)}T16:22:00Z`, details: 'Registration approved' },
  { auditId: 4, entityName: 'UserAccount', entityId: 5, action: 'Deactivate', userName: 'admin', timestamp: `${shift(-4)}T09:15:00Z`, details: 'Account archived' },
  { auditId: 5, entityName: 'Report', entityId: 0, action: 'Export', userName: 'football', timestamp: `${shift(-5)}T14:02:00Z`, details: 'Team roster exported as XLS' },
];
