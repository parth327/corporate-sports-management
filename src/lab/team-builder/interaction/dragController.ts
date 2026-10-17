import { PLAYER_BY_ID, ROLE_COLOR } from '../data/squad';
import { magnetAt, type Magnet } from '../hooks/useSpatial';
import { useBuilder, type DragSource } from '../store/builderStore';
import { bridge, drag, fx, ghost, impact, inside } from '../store/spatialBridge';

/**
 * The life of a dragged card, outside React.
 *
 *   pick up   beginDrag  — the ghost appears exactly over the card or chip it lifts
 *   drag      tick       — each frame: raycast for the magnet, pull the ghost toward it,
 *                          condense the card into a chip as it closes on a node
 *   release   endDrag    — place / swap / bench / cancel, and set the ghost flying
 *   fly       tick       — snap: chase the node's projected point as the camera eases;
 *                          return: glide home to the card
 *   land      land       — the real chip or card takes over, and a placement fires the impact
 *
 * `tick` runs in the canvas frame loop, straight after the slots are
 * projected, so the ghost always chases this frame's screen positions.
 */

/** Magnet strength at which a node counts as the target. */
const CAPTURE = 0.28;
/** A release carries on along its velocity this long, so a flick throws the card to the node it was heading for. */
const THROW_MS = 110;
const THROW_MAX = 180;
/** A flight lands when it arrives, or after this long whatever its springs are doing. */
const SNAP_TIMEOUT = 950;
const RETURN_TIMEOUT = 900;

const magnet: Magnet = { slot: -1, strength: 0 };
const thrown: Magnet = { slot: -1, strength: 0 };

/* Last values sent to the springs: re-sending an unchanged target would restart them every frame. */
const sent = { x: Number.NaN, y: Number.NaN, morph: Number.NaN };

function aim(x: number, y: number, morph: number) {
  if (x !== sent.x) ghost.x.set((sent.x = x));
  if (y !== sent.y) ghost.y.set((sent.y = y));
  if (morph !== sent.morph) ghost.morph.set((sent.morph = morph));
}

/** Puts the ghost somewhere without animating, at the current card size. */
function teleport(x: number, y: number, morph: number) {
  ghost.width.set(drag.width);
  ghost.height.set(drag.height);
  ghost.x.jump((sent.x = x));
  ghost.y.jump((sent.y = y));
  ghost.morph.jump((sent.morph = morph));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ *
 * Pointer lifecycle
 * ------------------------------------------------------------------ */

/**
 * Starts a drag for `owner` (one per card or chip), or refuses with false:
 * there is one ghost, so a second finger's gesture is ignored rather than
 * allowed to steer the first.
 */
export function beginDrag(
  owner: object,
  playerId: string,
  source: DragSource,
  el: HTMLElement,
  x: number,
  y: number,
): boolean {
  if (drag.active) return false;
  settleFlight();
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  if (source.kind === 'slot') {
    /* A chip lifted off the pitch turns back into a card over the roster: take a real card's size. */
    const card = bridge.cards.get(playerId) ?? bridge.cards.values().next().value;
    if (card && card.offsetWidth > 0) {
      drag.width = card.offsetWidth;
      drag.height = card.offsetHeight;
    }
  } else {
    /* Layout size, not the rect: a pressed card is scaled down by its :active style. */
    drag.width = el.offsetWidth;
    drag.height = el.offsetHeight;
  }
  drag.owner = owner;
  drag.active = true;
  drag.pointerX = x;
  drag.pointerY = y;
  drag.grabX = x - cx;
  drag.grabY = y - cy;
  drag.vx = 0;
  drag.vy = 0;
  drag.magnet = 0;
  drag.slot = -1;
  drag.overRoster = false;

  ghost.phase = 'drag';
  ghost.playerId = playerId;
  ghost.slot = -1;
  ghost.impact = false;
  ghost.since = performance.now();
  ghost.homeX = cx;
  ghost.homeY = cy;
  teleport(cx, cy, source.kind === 'slot' ? 1 : 0);
  useBuilder.getState().startDrag(playerId, source);
  return true;
}

export function moveDrag(x: number, y: number, vx: number, vy: number): void {
  if (!drag.active) return;
  drag.pointerX = x;
  drag.pointerY = y;
  drag.vx = vx;
  drag.vy = vy;
}

/** Samples along a flick's path; the first node it passes close to is the one it was thrown at. */
const THROW_SAMPLES = 5;

/** Where a release at (x, y) lands: over a node, or the first node along a flick's path; -1 for neither. */
function dropTarget(x: number, y: number, vx: number, vy: number): number {
  magnetAt(x, y, magnet);
  if (magnet.strength >= CAPTURE) return magnet.slot;
  const reach = Math.min(1, THROW_MAX / Math.max(Math.hypot(vx, vy) * THROW_MS, 1e-6));
  const dx = vx * THROW_MS * reach;
  const dy = vy * THROW_MS * reach;
  if (Math.hypot(dx, dy) < 12) return -1;
  for (let i = 1; i <= THROW_SAMPLES; i += 1) {
    const t = i / THROW_SAMPLES;
    magnetAt(x + dx * t, y + dy * t, thrown);
    if (thrown.strength >= CAPTURE) return thrown.slot;
  }
  return -1;
}

export function endDrag(x: number, y: number, vx: number, vy: number, cancelled: boolean): void {
  drag.quietUntil = performance.now() + 350;
  if (!drag.active) return;
  drag.active = false;
  drag.owner = null;
  const store = useBuilder.getState();
  const source = store.dragSource;
  const id = ghost.playerId;
  store.endDrag();
  if (!source) {
    ghost.phase = 'idle';
    return;
  }

  /* Where the player is now, not where the drag began: the lineup can change under a drag. */
  const origin = store.lineup.indexOf(id);
  const overRoster = inside(bridge.roster, x, y);
  const slot = cancelled || overRoster ? -1 : dropTarget(x, y, vx, vy);
  const fromPitch = source.kind === 'slot' && origin >= 0;

  if (slot >= 0 && slot !== origin) {
    store.place(id, slot, true);
    snapTo(slot, true);
  } else if (fromPitch && overRoster && !cancelled) {
    store.bench(origin);
    store.fly(id);
    returnToCard(id);
  } else if (fromPitch) {
    /* Released back where they stand, or nowhere: the chip flies home and nothing changes. */
    store.fly(id);
    snapTo(origin, false);
  } else {
    store.fly(id);
    returnToCard(id);
  }
}

/**
 * The click a browser fires on pointerup after a drag (the pointer was
 * captured, so it goes to the dragged element). Keyboard clicks have no
 * pointer behind them (`detail` 0) and always count.
 */
export function isDragClick(event: { detail: number }): boolean {
  return event.detail > 0 && performance.now() < drag.quietUntil;
}

/** Escape mid-drag, or the dragged element unmounting: back where it came from, nothing changed. */
export function cancelDrag(): void {
  if (drag.active) endDrag(drag.pointerX, drag.pointerY, 0, 0, true);
}

/** Brings any card still in the air down at once: before a new gesture, or before the lineup changes under it. */
export function settleFlight(): void {
  if (ghost.phase === 'snap') land();
  else if (ghost.phase === 'return') settle();
}

/** For actions that rewrite the lineup wholesale (clear, auto-pick, bench): nothing may be mid-air when they do. */
export function groundEverything(): void {
  cancelDrag();
  settleFlight();
}

/* ------------------------------------------------------------------ *
 * Flights started without a drag: a tap or the keyboard
 * ------------------------------------------------------------------ */

/**
 * Places a player in a slot, flying a ghost from wherever they are now — their
 * roster card, or their chip on the pitch — when that start point is on
 * screen. With reduced motion, or nowhere visible to start from, the placement
 * is immediate and the pitch still marks it.
 */
export function launch(playerId: string, slot: number): void {
  settleFlight();
  const store = useBuilder.getState();
  const player = PLAYER_BY_ID.get(playerId);
  if (!player) return;
  const from = store.lineup.indexOf(playerId);
  if (from === slot) {
    store.select(null);
    return;
  }

  const chip = from >= 0 ? bridge.slotScreen[from] : undefined;
  const card = from < 0 ? bridge.cards.get(playerId)?.getBoundingClientRect() : undefined;
  const roster = bridge.roster;
  const cardVisible =
    card !== undefined &&
    card.width > 0 &&
    card.bottom > roster.top &&
    card.top < roster.top + roster.height &&
    card.right > roster.left &&
    card.left < roster.left + roster.width;
  const canFly =
    !bridge.reducedMotion && ghost.phase === 'idle' && !drag.active && (chip?.visible === true || cardVisible);

  if (!canFly) {
    store.place(playerId, slot);
    impact(slot, ROLE_COLOR[player.role]);
    return;
  }

  if (chip?.visible) {
    teleport(chip.x, chip.y, 1);
  } else if (card) {
    const el = bridge.cards.get(playerId);
    drag.width = el?.offsetWidth || card.width;
    drag.height = el?.offsetHeight || card.height;
    teleport(card.left + card.width / 2, card.top + card.height / 2, 0);
  }
  ghost.playerId = playerId;
  store.place(playerId, slot, true);
  snapTo(slot, true);
}

/* ------------------------------------------------------------------ *
 * Flights
 * ------------------------------------------------------------------ */

function snapTo(slot: number, placement: boolean) {
  ghost.phase = 'snap';
  ghost.slot = slot;
  ghost.impact = placement;
  ghost.since = performance.now();
}

function returnToCard(id: string) {
  const roster = bridge.roster;
  const card = bridge.cards.get(id)?.getBoundingClientRect();
  if (card && card.width > 0) {
    ghost.homeX = card.left + card.width / 2;
    ghost.homeY = card.top + card.height / 2;
  } else {
    ghost.homeX = roster.left + roster.width / 2;
    ghost.homeY = roster.top + roster.height / 2;
  }
  /* A card scrolled out of view: land at the nearest edge of the list rather than fly off under the glass. */
  if (roster.width > 0) {
    const margin = Math.min(drag.height / 2 + 8, roster.height / 2);
    ghost.homeX = clamp(ghost.homeX, roster.left + drag.width / 2, roster.left + roster.width - drag.width / 2);
    ghost.homeY = clamp(ghost.homeY, roster.top + margin, roster.top + roster.height - margin);
  }
  ghost.phase = 'return';
  ghost.since = performance.now();
}

function land() {
  const { slot, playerId, impact: placement } = ghost;
  ghost.phase = 'idle';
  const store = useBuilder.getState();
  store.land();
  const player = PLAYER_BY_ID.get(playerId);
  /* Only a player still standing where they flew to earns the ripple: the lineup can change mid-flight. */
  if (placement && player && store.lineup[slot] === playerId) impact(slot, ROLE_COLOR[player.role]);
}

/** A returning card arrives home. */
function settle() {
  ghost.phase = 'idle';
  useBuilder.getState().land();
}

/* ------------------------------------------------------------------ *
 * Per frame
 * ------------------------------------------------------------------ */

function tickDrag() {
  const store = useBuilder.getState();
  drag.overRoster = inside(bridge.roster, drag.pointerX, drag.pointerY);
  if (drag.overRoster) {
    magnet.slot = -1;
    magnet.strength = 0;
  } else {
    magnetAt(drag.pointerX, drag.pointerY, magnet);
  }
  drag.magnet = magnet.strength;
  drag.slot = magnet.strength >= CAPTURE ? magnet.slot : -1;
  store.setHoverSlot(drag.slot);

  const fromSlot = store.dragSource?.kind === 'slot';
  const pull = drag.slot >= 0 ? magnet.strength : 0;
  /* Closing on a node the card condenses toward the chip it will become; over the roster it is a card again. */
  const morph = drag.overRoster ? 0 : fromSlot ? Math.max(0.75, pull) : Math.min(1, pull * 1.15);

  /* The grab point stays under the finger, shrinking toward the centre as the card condenses. */
  let tx = drag.pointerX - drag.grabX * (1 - morph);
  let ty = drag.pointerY - drag.grabY * (1 - morph);
  const node = drag.slot >= 0 ? bridge.slotScreen[drag.slot] : undefined;
  if (node) {
    const k = pull * pull * 0.5;
    tx += (node.x - tx) * k;
    ty += (node.y - ty) * k;
  }
  aim(tx, ty, morph);
}

function tickSnap(now: number) {
  const node = bridge.slotScreen[ghost.slot];
  /* With reduced motion there is no flight: the chip is simply there. */
  if (!node || bridge.reducedMotion) {
    land();
    return;
  }
  aim(node.x, node.y, 1);
  const off = Math.hypot(ghost.x.get() - node.x, ghost.y.get() - node.y);
  const speed = Math.abs(ghost.x.getVelocity()) + Math.abs(ghost.y.getVelocity());
  if ((off < 1.2 && speed < 90 && ghost.morph.get() > 0.97) || now - ghost.since > SNAP_TIMEOUT) land();
}

function tickReturn(now: number) {
  aim(ghost.homeX, ghost.homeY, 0);
  const off = Math.hypot(ghost.x.get() - ghost.homeX, ghost.y.get() - ghost.homeY);
  const settled = off < 1.5 && ghost.morph.get() < 0.03;
  if (settled || bridge.reducedMotion || now - ghost.since > RETURN_TIMEOUT) settle();
}

export function tick(now: number): void {
  if (ghost.phase === 'drag') tickDrag();
  else if (ghost.phase === 'snap') tickSnap(now);
  else if (ghost.phase === 'return') tickReturn(now);
}

/**
 * Leaves nothing in the air when the page unmounts, mid-drag or mid-flight.
 * The store and the impact buffer are modules, so they outlive the page: the
 * lineup is kept for the session on purpose, but a half-finished gesture is
 * not, and old impacts are cleared because the next canvas clock starts again
 * at zero and would replay them when it reached their timestamps.
 */
export function resetInteraction(): void {
  drag.active = false;
  ghost.phase = 'idle';
  ghost.playerId = '';
  sent.x = sent.y = sent.morph = Number.NaN;
  useBuilder.setState({ dragging: null, dragSource: null, flight: null, hoverSlot: -1, selected: null, targetSlot: -1 });
  fx.impacts.forEach((entry) => {
    entry.time = -100;
    entry.strength = 0;
  });
  fx.kick = 0;
  fx.lastSlot = -1;
}
