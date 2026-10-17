import { memo, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import clsx from 'clsx';
import { FORMATIONS, PLAYER_BY_ID, ROLE_COLOR, type Slot } from '../data/squad';
import { useCardDrag } from '../hooks/useCardDrag';
import { useSlotAnchor } from '../hooks/useSpatial';
import { groundEverything, isDragClick, launch } from '../interaction/dragController';
import { useBuilder, type DragSource } from '../store/builderStore';
import { bridge } from '../store/spatialBridge';
import { PlayerChip, roleStyle } from './PlayerFace';

const STEP: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** The next node along an arrow key, judged on screen, so arrows follow the pitch as the viewer sees it. */
function nodeToward(from: number, key: string): number {
  const step = STEP[key];
  const origin = bridge.slotScreen[from];
  if (!step || !origin) return -1;
  let best = -1;
  let bestScore = Infinity;
  bridge.slotScreen.forEach((point, index) => {
    if (index === from || !point.visible) return;
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const along = dx * step[0] + dy * step[1];
    if (along <= 4) return;
    const across = Math.abs(dx * step[1] - dy * step[0]);
    const score = along + across * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

const focusNode = (slot: number) =>
  document.querySelector<HTMLElement>(`[data-slot-button="${slot}"]`)?.focus({ preventScroll: true });

interface AnchorProps {
  index: number;
  slot: Slot;
  playerId: string | null;
  tabbable: boolean;
  onFocusNode: (index: number) => void;
}

/**
 * One node's DOM twin: a real button pinned to the hologram's projected
 * position every frame by the canvas. It is what keyboard, touch and screen
 * reader users operate, what shows the player's chip, and what a chip is
 * dragged from when a player moves or goes back to the bench.
 */
const SlotAnchor = memo(function SlotAnchor({ index, slot, playerId, tabbable, onFocusNode }: AnchorProps) {
  const anchor = useSlotAnchor(index);
  const chipRef = useRef<HTMLButtonElement | null>(null);
  const player = playerId ? PLAYER_BY_ID.get(playerId) : undefined;
  const source = useMemo<DragSource>(() => ({ kind: 'slot', slot: index }), [index]);

  const hovered = useBuilder((s) => s.hoverSlot === index);
  const targeted = useBuilder((s) => s.targetSlot === index);
  const holding = useBuilder((s) => s.selected);
  /*
   * In the air (dragged or flying) the chip is transparent, not unmounted and
   * not `visibility: hidden`: unmounting would drop the pointer capture
   * mid-drag, and a hidden button loses keyboard focus to <body> — which is
   * exactly where focus is when a keyboard placement flies in.
   */
  const airborne = useBuilder((s) => playerId !== null && (s.dragging === playerId || s.flight === playerId));
  const bind = useCardDrag(chipRef, playerId ?? '', source, null);

  const holder = holding ? PLAYER_BY_ID.get(holding) : undefined;
  const pickedHere = holding !== null && holding === playerId;

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDragClick(event)) return;
    const state = useBuilder.getState();
    if (state.selected && state.selected !== playerId) {
      launch(state.selected, index);
      return;
    }
    if (player) {
      bridge.pickOrigin = pickedHere ? null : event.currentTarget;
      state.select(pickedHere ? null : player.id);
      return;
    }
    state.target(index);
    /* From the keyboard, continue in the (now filtered) squad list. */
    if (event.detail === 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-variant]')?.focus({ preventScroll: true }));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key in STEP) {
      const next = nodeToward(index, event.key);
      event.preventDefault();
      if (next >= 0) focusNode(next);
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && player) {
      event.preventDefault();
      groundEverything();
      useBuilder.getState().bench(index);
    }
  };

  /* Empty nodes show their code ("LB"), so the name starts with it for voice control; filled ones show the player. */
  const label = player
    ? `${slot.name}: ${player.name}, rating ${player.rating}.${pickedHere ? ' Picked up: choose where to move them.' : ' Enter to move, Delete to bench.'}`
    : `${slot.code}, ${slot.name.toLowerCase()}, empty.${holder ? ` Enter to place ${holder.name}.` : ' Enter to choose a player for it.'}`;

  return (
    /* Placed and stacked (nearer nodes over farther ones) by the canvas every frame; hidden until first projected. */
    <div ref={anchor} className="absolute left-0 top-0 will-change-transform" style={{ visibility: 'hidden' }}>
      {player ? (
        <button
          ref={chipRef}
          {...bind()}
          type="button"
          data-slot-button={index}
          tabIndex={tabbable ? 0 : -1}
          aria-label={label}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={() => onFocusNode(index)}
          className={clsx(
            'pointer-events-auto absolute left-0 top-0 flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center rounded-full outline-none active:cursor-grabbing',
            'focus-visible:ring-4 focus-visible:ring-solar-400/85 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b18]',
            airborne && 'opacity-0',
          )}
          style={{ ...roleStyle(player), touchAction: 'none' }}
        >
          <PlayerChip
            player={player}
            className={clsx('transition-transform duration-200', (hovered || pickedHere) && 'scale-[1.12]', pickedHere && 'animate-pulse')}
          />
          <span className="tb-fs-micro pointer-events-none absolute top-full mt-1.5 hidden whitespace-nowrap rounded-full bg-[#070b18]/85 px-2 py-0.5 font-cond text-white/90 ring-1 ring-white/10 md:block">
            {player.name.split(' ').slice(-1)[0]}
          </span>
        </button>
      ) : (
        <button
          type="button"
          data-slot-button={index}
          tabIndex={tabbable ? 0 : -1}
          aria-label={label}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={() => onFocusNode(index)}
          className="group pointer-events-auto absolute left-0 top-0 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none"
          style={{ '--tb-role': ROLE_COLOR[slot.role] } as CSSProperties}
        >
          <span
            aria-hidden="true"
            className={clsx(
              'absolute inset-0 rounded-full transition-[box-shadow,opacity] duration-200',
              'group-focus-visible:shadow-[0_0_0_3px_rgba(255,214,51,0.9)]',
              targeted && 'animate-pulse-ring shadow-[0_0_0_2px_var(--tb-role)]',
            )}
          />
          <span
            aria-hidden="true"
            className={clsx(
              'tb-fs-micro absolute top-[calc(100%+0.1rem)] whitespace-nowrap rounded-full px-2 py-0.5 font-mono font-bold uppercase tracking-wider2 ring-1 transition-colors',
              hovered || targeted
                ? 'bg-[color:var(--tb-role)] text-[#060913] ring-transparent'
                : 'bg-[#070b18]/85 text-white/90 ring-white/15',
            )}
          >
            {slot.code}
          </span>
        </button>
      )}
    </div>
  );
});

/** Every node's DOM twin, above the canvas and below the glass panels. Arrow keys move between them. */
export function SlotLayer() {
  const formation = useBuilder((s) => s.formation);
  const lineup = useBuilder((s) => s.lineup);
  const [active, setActive] = useState(0);

  return (
    <div role="group" aria-label={`Pitch, formation ${formation}. Use the arrow keys to move between positions.`} className="pointer-events-none fixed inset-0 z-10">
      {FORMATIONS[formation].map((slot, index) => (
        <SlotAnchor
          key={index}
          index={index}
          slot={slot}
          playerId={lineup[index] ?? null}
          tabbable={index === active}
          onFocusNode={setActive}
        />
      ))}
    </div>
  );
}
