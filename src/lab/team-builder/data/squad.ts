import { STANDINGS } from '@/lib/site-data.js';

/**
 * Local demo data for the spatial team builder. Nothing here touches the API:
 * the prototype is about the interaction, not persistence.
 *
 * Pitch space is metres on a regulation 68 × 105 ground: x runs touchline to
 * touchline, z runs from the opposition goal (−52.5) to our own (+52.5), so the
 * camera looks up the pitch from behind the keeper.
 */

export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';

export const ROLES: { id: Role; label: string }[] = [
  { id: 'GK', label: 'Keepers' },
  { id: 'DEF', label: 'Defenders' },
  { id: 'MID', label: 'Midfield' },
  { id: 'FWD', label: 'Forwards' },
];

/** Neon per role, in the ACE palette: solar keepers, azure defence, phthalo midfield, magenta attack. */
export const ROLE_COLOR: Record<Role, string> = {
  GK: '#FFCB00',
  DEF: '#4A96D1',
  MID: '#22BC8A',
  FWD: '#DB55A5',
};

export interface Slot {
  role: Role;
  /** Short position code shown on the node, e.g. "LB". */
  code: string;
  /** Spoken name, e.g. "Left back". */
  name: string;
  x: number;
  z: number;
}

export type FormationId = '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1';

const GK: Slot = { role: 'GK', code: 'GK', name: 'Goalkeeper', x: 0, z: 45 };
const BACK_FOUR: Slot[] = [
  { role: 'DEF', code: 'LB', name: 'Left back', x: -24, z: 27 },
  { role: 'DEF', code: 'LCB', name: 'Left centre back', x: -9, z: 32 },
  { role: 'DEF', code: 'RCB', name: 'Right centre back', x: 9, z: 32 },
  { role: 'DEF', code: 'RB', name: 'Right back', x: 24, z: 27 },
];

/** Eleven slots each, in a fixed order, so switching formation keeps each player on the same index. */
export const FORMATIONS: Record<FormationId, Slot[]> = {
  '4-3-3': [
    GK,
    ...BACK_FOUR,
    { role: 'MID', code: 'LCM', name: 'Left centre mid', x: -15, z: 9 },
    { role: 'MID', code: 'CM', name: 'Centre mid', x: 0, z: 14 },
    { role: 'MID', code: 'RCM', name: 'Right centre mid', x: 15, z: 9 },
    { role: 'FWD', code: 'LW', name: 'Left wing', x: -22, z: -17 },
    { role: 'FWD', code: 'ST', name: 'Striker', x: 0, z: -23 },
    { role: 'FWD', code: 'RW', name: 'Right wing', x: 22, z: -17 },
  ],
  '4-4-2': [
    GK,
    ...BACK_FOUR,
    { role: 'MID', code: 'LM', name: 'Left mid', x: -24, z: 5 },
    { role: 'MID', code: 'LCM', name: 'Left centre mid', x: -8, z: 10 },
    { role: 'MID', code: 'RCM', name: 'Right centre mid', x: 8, z: 10 },
    { role: 'MID', code: 'RM', name: 'Right mid', x: 24, z: 5 },
    { role: 'FWD', code: 'LS', name: 'Left striker', x: -8, z: -20 },
    { role: 'FWD', code: 'RS', name: 'Right striker', x: 8, z: -20 },
  ],
  '3-5-2': [
    GK,
    { role: 'DEF', code: 'LCB', name: 'Left centre back', x: -15, z: 31 },
    { role: 'DEF', code: 'CB', name: 'Centre back', x: 0, z: 34 },
    { role: 'DEF', code: 'RCB', name: 'Right centre back', x: 15, z: 31 },
    { role: 'MID', code: 'LWB', name: 'Left wing back', x: -27, z: 9 },
    { role: 'MID', code: 'LCM', name: 'Left centre mid', x: -11, z: 11 },
    { role: 'MID', code: 'CDM', name: 'Defensive mid', x: 0, z: 18 },
    { role: 'MID', code: 'RCM', name: 'Right centre mid', x: 11, z: 11 },
    { role: 'MID', code: 'RWB', name: 'Right wing back', x: 27, z: 9 },
    { role: 'FWD', code: 'LS', name: 'Left striker', x: -8, z: -20 },
    { role: 'FWD', code: 'RS', name: 'Right striker', x: 8, z: -20 },
  ],
  '4-2-3-1': [
    GK,
    ...BACK_FOUR,
    { role: 'MID', code: 'LDM', name: 'Left defensive mid', x: -9, z: 17 },
    { role: 'MID', code: 'RDM', name: 'Right defensive mid', x: 9, z: 17 },
    { role: 'MID', code: 'LAM', name: 'Left attacking mid', x: -20, z: -3 },
    { role: 'MID', code: 'CAM', name: 'Attacking mid', x: 0, z: -5 },
    { role: 'MID', code: 'RAM', name: 'Right attacking mid', x: 20, z: -3 },
    { role: 'FWD', code: 'ST', name: 'Striker', x: 0, z: -24 },
  ],
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];
export const SLOT_COUNT = 11;

export interface Player {
  id: string;
  name: string;
  number: number;
  role: Role;
  /** Preferred position code. */
  position: string;
  rating: number;
  /** Index into STANDINGS: the division, and so the colour, the player competes under. */
  division: number;
  stats: { pace: number; attack: number; passing: number; defence: number };
}

export const DIVISIONS = STANDINGS.map((row) => ({ name: row.division, shade: row.shade, hex: row.hex }));

type Row = [name: string, number: number, role: Role, position: string, rating: number, division: number, stats: [number, number, number, number]];

const ROWS: Row[] = [
  ['Harsh Trivedi', 1, 'GK', 'GK', 84, 0, [52, 20, 61, 83]],
  ['Kavya Solanki', 23, 'GK', 'GK', 79, 3, [49, 18, 57, 78]],
  ['Arjun Mehta', 2, 'DEF', 'RB', 81, 1, [84, 58, 74, 79]],
  ['Rohan Desai', 4, 'DEF', 'CB', 86, 0, [67, 45, 69, 88]],
  ['Siddharth Rana', 5, 'DEF', 'CB', 83, 5, [62, 41, 64, 85]],
  ['Ishaan Parikh', 3, 'DEF', 'LB', 78, 2, [82, 55, 72, 76]],
  ['Neha Gandhi', 15, 'DEF', 'CB', 80, 4, [70, 38, 66, 82]],
  ['Yash Chauhan', 12, 'DEF', 'RB', 74, 7, [79, 50, 68, 72]],
  ['Aarav Shah', 8, 'MID', 'CM', 88, 0, [76, 79, 91, 70]],
  ['Diya Joshi', 6, 'MID', 'CDM', 83, 1, [69, 64, 82, 84]],
  ['Vihaan Patel', 10, 'MID', 'CAM', 87, 2, [81, 86, 89, 48]],
  ['Saanvi Bhatt', 14, 'MID', 'CM', 79, 3, [74, 70, 83, 66]],
  ['Kabir Amin', 16, 'MID', 'LM', 77, 6, [85, 73, 76, 51]],
  ['Ananya Vyas', 18, 'MID', 'RM', 76, 4, [84, 70, 75, 49]],
  ['Manav Thakkar', 20, 'MID', 'CDM', 75, 5, [63, 58, 74, 79]],
  ['Reyansh Dave', 9, 'FWD', 'ST', 89, 0, [86, 92, 77, 38]],
  ['Myra Pandya', 11, 'FWD', 'LW', 85, 1, [92, 84, 80, 35]],
  ['Parth Shukla', 7, 'FWD', 'RW', 84, 2, [90, 83, 78, 40]],
  ['Riya Raval', 19, 'FWD', 'ST', 80, 6, [81, 85, 69, 36]],
  ['Devansh Modi', 17, 'FWD', 'LW', 77, 7, [88, 76, 72, 33]],
  ['Tanvi Shah', 21, 'FWD', 'RW', 75, 3, [87, 74, 70, 34]],
  ['Nikhil Joshi', 22, 'DEF', 'LB', 73, 6, [80, 48, 66, 71]],
];

export const PLAYERS: Player[] = ROWS.map(([name, number, role, position, rating, division, [pace, attack, passing, defence]]) => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  number,
  role,
  position,
  rating,
  division,
  stats: { pace, attack, passing, defence },
}));

export const PLAYER_BY_ID = new Map(PLAYERS.map((p) => [p.id, p]));

/** Two-letter badge for a chip: initials of the first and last name. */
export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const ROLE_ORDER: Role[] = ['GK', 'DEF', 'MID', 'FWD'];

/** How well a player suits a slot: 1 their position, 0.85 same role, 0.6 neighbouring line, 0.3 otherwise. */
export function fit(player: Player, slot: Slot): number {
  const striker = player.position === 'ST' && (slot.code === 'LS' || slot.code === 'RS');
  if (slot.code === player.position || slot.code.endsWith(player.position) || striker) return 1;
  if (player.role === slot.role) return 0.85;
  if (player.role === 'GK' || slot.role === 'GK') return 0.3;
  const gap = Math.abs(ROLE_ORDER.indexOf(player.role) - ROLE_ORDER.indexOf(slot.role));
  return gap === 1 ? 0.6 : 0.3;
}
