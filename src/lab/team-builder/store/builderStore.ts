import { create } from 'zustand';
import {
  FORMATIONS,
  PLAYER_BY_ID,
  PLAYERS,
  SLOT_COUNT,
  fit,
  type FormationId,
  type Role,
} from '../data/squad';

/**
 * Discrete UI state only. Anything that changes every frame (pointer, magnet
 * strength, projected screen positions) lives in `spatialBridge.ts` instead,
 * so a drag never re-renders React sixty to a hundred and twenty times a second.
 */

export type DragSource = { kind: 'roster' } | { kind: 'slot'; slot: number };

export interface Drop {
  slot: number;
  playerId: string;
  /** Monotonic counter, so two drops on the same slot are still two events. */
  seq: number;
}

interface BuilderState {
  formation: FormationId;
  /** Player id per slot index; the same index survives a formation change. */
  lineup: (string | null)[];
  /** Picked up from the keyboard or with a tap, waiting for a slot. */
  selected: string | null;
  /** The other way round: an empty slot chosen first, waiting for a player. */
  targetSlot: number;
  /** Slot the dragged card is magnetised to, or -1. */
  hoverSlot: number;
  dragging: string | null;
  dragSource: DragSource | null;
  /**
   * Released, but its ghost is still in the air: flying in to a slot, or back
   * to where it came from. Whatever it is flying to stays hidden until it lands,
   * so the ghost and the real element never show at once.
   */
  flight: string | null;
  roleFilter: Role | 'ALL';
  lastDrop: Drop | null;
  announcement: string;

  setFormation: (id: FormationId) => void;
  /** `flying`: a ghost is travelling to the slot, so its chip stays hidden until `land()`. */
  place: (playerId: string, slot: number, flying?: boolean) => void;
  bench: (slot: number) => void;
  select: (playerId: string | null) => void;
  /** Chooses an empty slot to fill next, and narrows the roster to its role; -1 clears. */
  target: (slot: number) => void;
  setHoverSlot: (slot: number) => void;
  startDrag: (playerId: string, source: DragSource) => void;
  endDrag: () => void;
  /** A ghost is returning somewhere without a change to the lineup. */
  fly: (playerId: string) => void;
  land: () => void;
  setRoleFilter: (role: Role | 'ALL') => void;
  autoPick: () => void;
  clear: () => void;
}

export interface TeamSummary {
  filled: number;
  rating: number;
  /** Average suitability of placed players for their slots, 0..100. */
  fitPct: number;
}

export function summarize(lineup: (string | null)[], formation: FormationId): TeamSummary {
  const slots = FORMATIONS[formation];
  let filled = 0;
  let weighted = 0;
  let fitSum = 0;
  lineup.forEach((id, index) => {
    const player = id ? PLAYER_BY_ID.get(id) : undefined;
    const slot = slots[index];
    if (!player || !slot) return;
    const f = fit(player, slot);
    filled += 1;
    weighted += player.rating * (0.7 + 0.3 * f);
    fitSum += f;
  });
  return {
    filled,
    rating: filled ? Math.round(weighted / filled) : 0,
    fitPct: filled ? Math.round((fitSum / filled) * 100) : 0,
  };
}

let dropSeq = 0;

export const useBuilder = create<BuilderState>()((set, get) => {
  /**
   * A live region speaks only when its text changes, so an announcement
   * identical to the last one (Auto-pick pressed twice) gets an invisible
   * trailing no-break space and is heard again.
   */
  const say = (text: string) => ({
    announcement: text !== '' && get().announcement === text ? `${text} ` : text,
  });

  return {
    formation: '4-3-3',
    lineup: Array<string | null>(SLOT_COUNT).fill(null),
    selected: null,
    targetSlot: -1,
    hoverSlot: -1,
    dragging: null,
    dragSource: null,
    flight: null,
    roleFilter: 'ALL',
    lastDrop: null,
    announcement: '',

    setFormation: (id) => {
      if (id === get().formation) return;
      /* A position chosen in the old shape may not exist, or be a different role, in the new one. */
      set({ formation: id, targetSlot: -1, ...say(`Formation changed to ${id}.`) });
    },

    place: (playerId, slot, flying = false) => {
      const { lineup, formation } = get();
      const player = PLAYER_BY_ID.get(playerId);
      const target = FORMATIONS[formation][slot];
      if (!player || !target) return;

      const next = [...lineup];
      const from = next.indexOf(playerId);
      const displaced = next[slot] ?? null;
      if (displaced === playerId) {
        set({ selected: null });
        return;
      }
      next[slot] = playerId;
      if (from >= 0) next[from] = displaced;

      const other = displaced ? PLAYER_BY_ID.get(displaced) : undefined;
      const aside = other ? (from >= 0 ? `, swapping with ${other.name}` : `, ${other.name} to the bench`) : '';
      const { rating } = summarize(next, formation);
      dropSeq += 1;
      set({
        lineup: next,
        selected: null,
        targetSlot: -1,
        flight: flying ? playerId : null,
        lastDrop: { slot, playerId, seq: dropSeq },
        ...say(`${player.name} to ${target.name}${aside}. Team rating ${rating}.`),
      });
    },

    bench: (slot) => {
      const { lineup } = get();
      const id = lineup[slot];
      if (!id) return;
      const next = [...lineup];
      next[slot] = null;
      set({ lineup: next, selected: null, ...say(`${PLAYER_BY_ID.get(id)?.name ?? 'Player'} to the bench.`) });
    },

    select: (playerId) => {
      const player = playerId ? PLAYER_BY_ID.get(playerId) : undefined;
      set({
        selected: playerId,
        targetSlot: -1,
        ...say(player ? `${player.name} picked up. Choose a position on the pitch, or press Escape.` : ''),
      });
    },

    target: (slot) => {
      const target = FORMATIONS[get().formation][slot];
      if (!target) {
        set({ targetSlot: -1 });
        return;
      }
      set({
        targetSlot: slot,
        selected: null,
        roleFilter: target.role,
        ...say(`${target.name} chosen. Pick a player for it from the squad, or press Escape.`),
      });
    },

    setHoverSlot: (slot) => {
      if (get().hoverSlot !== slot) set({ hoverSlot: slot });
    },

    startDrag: (playerId, source) => set({ dragging: playerId, dragSource: source, selected: null, targetSlot: -1 }),

    endDrag: () => set({ dragging: null, dragSource: null, hoverSlot: -1 }),

    fly: (playerId) => set({ flight: playerId }),

    land: () => set({ flight: null }),

    setRoleFilter: (role) => set({ roleFilter: role }),

    autoPick: () => {
      const { formation } = get();
      const slots = FORMATIONS[formation];
      const taken = new Set<string>();
      const next = Array<string | null>(SLOT_COUNT).fill(null);
      /* Scarcest role first, so a greedy pick never spends the only keeper on an outfield slot. */
      const scarcity: Role[] = ['GK', 'DEF', 'FWD', 'MID'];
      const order = slots
        .map((slot, index) => ({ slot, index }))
        .sort((a, b) => scarcity.indexOf(a.slot.role) - scarcity.indexOf(b.slot.role));
      for (const { slot, index } of order) {
        let best: { id: string; score: number } | null = null;
        for (const player of PLAYERS) {
          if (taken.has(player.id)) continue;
          const score = player.rating * fit(player, slot);
          if (!best || score > best.score) best = { id: player.id, score };
        }
        if (best) {
          next[index] = best.id;
          taken.add(best.id);
        }
      }
      const { rating } = summarize(next, formation);
      set({ lineup: next, selected: null, targetSlot: -1, ...say(`Best eleven picked. Team rating ${rating}.`) });
    },

    clear: () =>
      set({
        lineup: Array<string | null>(SLOT_COUNT).fill(null),
        selected: null,
        targetSlot: -1,
        ...say('Pitch cleared.'),
      }),
  };
});

/** Where a player fits best: the best-suited empty slot, or the best-suited of all when the eleven is full. */
export function bestSlotFor(playerId: string, lineup: (string | null)[], formation: FormationId): number {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player) return -1;
  let best = -1;
  let bestScore = -1;
  FORMATIONS[formation].forEach((slot, index) => {
    const score = fit(player, slot) + (lineup[index] ? 0 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
