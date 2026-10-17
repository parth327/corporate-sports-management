import * as THREE from 'three';
import { motionValue, type MotionValue } from 'framer-motion';
import { SLOT_COUNT } from '../data/squad';

/**
 * The sync matrix between the DOM and the WebGL canvas.
 *
 * Plain mutable objects, written from the canvas frame loop and pointer
 * handlers and read the same way. Nothing here is React state: it changes on
 * every frame and every pointer move, and routing that through the reconciler
 * would re-render the page at the display's refresh rate.
 */

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The roster as a side rail (wide screens) or a bottom strip (phones and portrait tablets). */
export type CardVariant = 'rail' | 'strip';

export const bridge = {
  camera: null as THREE.PerspectiveCamera | null,
  /** The canvas's client rect, refreshed on resize; the basis of every projection. */
  rect: { left: 0, top: 0, width: 1, height: 1 } as Rect,
  /** The roster panel's client rect: dropping over it benches a player. */
  roster: { left: 0, top: 0, width: 0, height: 0 } as Rect,
  /** How far the glass panels reach in from each edge of the canvas; the camera frames the pitch in what is left. */
  insets: { top: 0, right: 0, bottom: 0, left: 0 } as Insets,
  /** Where each slot's hologram floats this frame; springs move these on a formation change. */
  slotWorld: Array.from({ length: SLOT_COUNT }, () => new THREE.Vector3()),
  /** The same points in client pixels, projected once per frame for the DOM. */
  slotScreen: Array.from({ length: SLOT_COUNT }, (): ScreenPoint => ({ x: 0, y: 0, visible: false })),
  /** Invisible hit volumes around each hologram, for raycasting. */
  hitTargets: [] as THREE.Object3D[],
  /** DOM elements pinned to each slot's projected position. */
  anchors: new Map<number, HTMLElement>(),
  /** Roster cards by player id, so a flight can start from, or return to, the right card. */
  cards: new Map<string, HTMLElement>(),
  /** Canvas clock in seconds, so DOM events can timestamp shader effects. */
  time: 0,
  reducedMotion: false,
  /** Eases the camera back to the framed view; installed by the camera rig. */
  recentre: null as (() => void) | null,
  /** The card or chip a player was picked up from, so Escape can hand focus back to it. */
  pickOrigin: null as HTMLElement | null,
};

/** The card under the pointer. */
export const drag = {
  active: false,
  pointerX: 0,
  pointerY: 0,
  /** Where inside the card it was grabbed, so the card does not jump to centre on the cursor. */
  grabX: 0,
  grabY: 0,
  /** The ghost card's size: the roster card it was lifted from. */
  width: 280,
  height: 76,
  /** Which card face the ghost wears: the roomy rail card or the compact strip card. */
  variant: 'rail' as CardVariant,
  /** Pointer velocity in px/ms, signed, straight from the gesture. */
  vx: 0,
  vy: 0,
  overRoster: false,
  /** 0..1 pull toward `slot`. */
  magnet: 0,
  slot: -1,
  /** Until this performance.now() time, a pointer click is the tail end of a drag, not a click. */
  quietUntil: 0,
  /** The gesture this drag belongs to; another card's gesture cannot steer or end it. */
  owner: null as object | null,
};

export type GhostPhase = 'idle' | 'drag' | 'snap' | 'return';

/**
 * The flying card. `x`/`y` are its centre in client pixels and `morph` runs
 * from 0 (the roster card) to 1 (the round chip it becomes over a slot).
 *
 * <DragGhost> swaps in Framer springs for these on mount, so every `.set()`
 * from the frame loop springs rather than jumps: the pointer while dragging, a
 * slot's projected position while snapping (it moves as the camera eases),
 * home while returning. `.jump()` teleports.
 */
export const ghost = {
  phase: 'idle' as GhostPhase,
  playerId: '',
  /** Destination slot while snapping. */
  slot: -1,
  /** Whether landing is a real placement, so it earns an impact. */
  impact: false,
  homeX: 0,
  homeY: 0,
  /** performance.now() when the current phase began. */
  since: 0,
  x: motionValue(0) as MotionValue<number>,
  y: motionValue(0) as MotionValue<number>,
  morph: motionValue(0) as MotionValue<number>,
  /** Card size for this flight. Motion values, so the morph re-derives when a new flight changes them. */
  width: motionValue(280),
  height: motionValue(76),
};

/* ------------------------------------------------------------------ *
 * Impacts: a drop's ripple, particle burst and lens kick
 * ------------------------------------------------------------------ */

export const IMPACT_SLOTS = 4;

export interface Impact {
  x: number;
  z: number;
  /** Canvas time the impact happened; -100 for an unused entry. */
  time: number;
  strength: number;
  color: THREE.Color;
}

/**
 * A ring buffer rather than a queue: the pitch shader, the particle system and
 * the post-processing each read every entry each frame, and none of them has
 * to be the one that drains it.
 */
export const fx = {
  impacts: Array.from({ length: IMPACT_SLOTS }, (): Impact => ({
    x: 0,
    z: 0,
    time: -100,
    strength: 0,
    color: new THREE.Color(),
  })),
  cursor: 0,
  /** Chromatic aberration energy: kicked by impacts, decayed by the effects pass. */
  kick: 0,
  /** Slot of the latest impact, for the camera to glance at. */
  lastSlot: -1,
};

export function impact(slot: number, color: string, strength = 1): void {
  const world = bridge.slotWorld[slot];
  const entry = fx.impacts[fx.cursor];
  if (!world || !entry) return;
  entry.x = world.x;
  entry.z = world.z;
  entry.time = bridge.time;
  entry.strength = strength;
  entry.color.set(color);
  fx.cursor = (fx.cursor + 1) % IMPACT_SLOTS;
  fx.kick = Math.min(1.4, fx.kick + strength);
  fx.lastSlot = slot;
}

export function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
}
