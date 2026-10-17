/**
 * Pitch geometry, with no three.js in sight.
 *
 * This lives apart from StadiumScene so the builder page can import the
 * layout eagerly while the renderer stays behind its lazy boundary. Importing
 * both from one module silently defeated the split — Rollup warned that the
 * dynamic import "will not move module into another chunk", and three.js
 * (~680 kB) was landing in the page chunk regardless.
 */

export type Sport = 'cricket' | 'football' | 'generic';

export interface StadiumSlot {
  /** `${playerSubTypeId}:${index}` — unique across the pitch. */
  key: string;
  playerSubTypeId: number;
  typeName: string;
  /** Position within its type, 0-based. */
  index: number;
  position: [number, number, number];
  occupant: { playerId: number; name: string } | null;
}

/**
 * `SPACING` is in world units but chosen against SCREEN size: the chips are
 * fixed-size DOM, so at this camera roughly one world unit is ~21px and a
 * 96px chip needs about 5 units of clearance. Spacing them like real players
 * (2–3 units) drew them on top of each other.
 */
const SPACING = 5.4;
/** Beyond this many in a band, wrap to a second rank instead of a wider line. */
const PER_ROW = 5;
const ROW_DEPTH = 2.6;

/** Where each kind of participant stands. Depth is what carries the meaning. */
const ZONES: Record<string, { z: number }> = {
  /* Cricket — bowler at the far end, batsmen at the near crease, keeper
     behind them, everyone else off toward the boundary. */
  Bowler: { z: -9.5 },
  Batsman: { z: 3.5 },
  'Wicket-keeper': { z: 9 },
  'Other support': { z: 13.5 },

  /* Football — a back-to-front ladder. */
  Goalkeeper: { z: 13 },
  Defender: { z: 5.5 },
  Midfielder: { z: -1 },
  Forward: { z: -8 },
};

export const sportOf = (subGroupName?: string): Sport => {
  const name = (subGroupName ?? '').toLowerCase();
  if (name.includes('cricket')) return 'cricket';
  if (name.includes('football')) return 'football';
  return 'generic';
};

/**
 * Lays a formation out on the pitch.
 *
 * A type the layout has never heard of still gets a sensible band rather than
 * landing on top of something else — sub-groups are user-defined, so the
 * stadium cannot assume it knows every type name it will be handed.
 */
export function layoutSlots(
  slots: { playerSubTypeId: number; playerSubTypeName?: string; max: number }[],
  occupantsByType: Map<number, { playerId: number; name: string }[]>,
): StadiumSlot[] {
  const out: StadiumSlot[] = [];
  const unknown = slots.filter((s) => !ZONES[s.playerSubTypeName ?? '']);

  slots.forEach((slot) => {
    const typeName = slot.playerSubTypeName ?? `Type ${slot.playerSubTypeId}`;
    const known = ZONES[typeName];
    /* Unknown types are stacked in their own bands behind the halfway line. */
    const fallbackIndex = unknown.indexOf(slot);
    const zone = known ?? { z: -3 + fallbackIndex * 6 };

    const taken = occupantsByType.get(slot.playerSubTypeId) ?? [];
    /* An over-full type (legacy data written before this formation existed)
       still gets a chip each, so the excess is visible and can be removed
       rather than silently hidden. */
    const count = Math.max(slot.max, taken.length);
    const rows = Math.ceil(count / PER_ROW);

    for (let i = 0; i < count; i += 1) {
      const row = Math.floor(i / PER_ROW);
      const inRow = i % PER_ROW;
      const rowCount = Math.min(PER_ROW, count - row * PER_ROW);
      const spread = (inRow - (rowCount - 1) / 2) * SPACING;
      /* Extra ranks step toward the camera and centre on the same axis. */
      const depth = zone.z + (row - (rows - 1) / 2) * ROW_DEPTH;

      out.push({
        key: `${slot.playerSubTypeId}:${i}`,
        playerSubTypeId: slot.playerSubTypeId,
        typeName,
        index: i,
        position: [spread, 0.2, depth],
        occupant: taken[i] ?? null,
      });
    }
  });

  return out;
}
