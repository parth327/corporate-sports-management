import { memo, useCallback, useRef, type MouseEvent } from 'react';
import clsx from 'clsx';
import { ROLES, type Player, type Slot } from '../data/squad';
import { useCardDrag } from '../hooks/useCardDrag';
import { isDragClick, launch } from '../interaction/dragController';
import { bestSlotFor, useBuilder, type DragSource } from '../store/builderStore';
import { bridge, type CardVariant } from '../store/spatialBridge';
import { CardFace, roleStyle } from './PlayerFace';

const FROM_ROSTER: DragSource = { kind: 'roster' };
const ROLE_NAME = Object.fromEntries(ROLES.map((r) => [r.id, r.label.replace(/s$/, '').toLowerCase()]));

/** Moves keyboard focus to a slot on the pitch without scrolling anything. */
export function focusSlot(slot: number) {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[data-slot-button="${slot}"]`)?.focus({ preventScroll: true }),
  );
}

interface PlayerCardProps {
  player: Player;
  /** The slot the player holds, if on the pitch. */
  slot: Slot | null;
  variant: CardVariant;
}

/**
 * A roster card. One button, three ways in:
 *  - drag it (mouse, pen, or touch across the list's scroll axis) onto a node;
 *  - tap or click it to pick the player up, then tap a node;
 *  - Enter or Space to pick up, which also moves focus to the best position,
 *    so the whole thing works from the keyboard.
 * If a position was chosen first, any of these fills that position instead.
 */
export const PlayerCard = memo(function PlayerCard({ player, slot, variant }: PlayerCardProps) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const selected = useBuilder((s) => s.selected === player.id);
  const lifted = useBuilder((s) => s.dragging === player.id || s.flight === player.id);
  const bind = useCardDrag(ref, player.id, FROM_ROSTER, variant === 'rail' ? 'y' : 'x');

  const register = useCallback(
    (el: HTMLButtonElement | null) => {
      ref.current = el;
      if (el) bridge.cards.set(player.id, el);
      else bridge.cards.delete(player.id);
    },
    [player.id],
  );

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDragClick(event)) return;
    const state = useBuilder.getState();
    if (state.targetSlot >= 0) {
      const target = state.targetSlot;
      launch(player.id, target);
      if (event.detail === 0) focusSlot(target);
      return;
    }
    if (state.selected === player.id) {
      state.select(null);
      return;
    }
    bridge.pickOrigin = event.currentTarget;
    state.select(player.id);
    /* From the keyboard (a click with no pointer behind it), carry focus to where the player fits best. */
    if (event.detail === 0) focusSlot(bestSlotFor(player.id, state.lineup, state.formation));
  };

  const where = slot ? `On the pitch at ${slot.name}.` : 'On the bench.';
  return (
    <li className={variant === 'strip' ? 'w-[min(15.5rem,70vw)] shrink-0 snap-start' : undefined}>
      <button
        ref={register}
        {...bind()}
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${player.name}, ${ROLE_NAME[player.role]}, ${player.position}, number ${player.number}, rating ${player.rating}. ${where}`}
        aria-describedby="tb-card-help"
        className={clsx(
          'tb-card tb-fs-body relative block w-full cursor-grab overflow-hidden rounded-2xl text-left outline-none transition-[transform,opacity,border-color,box-shadow] duration-200 ease-out active:cursor-grabbing',
          'focus-visible:ring-2 focus-visible:ring-solar-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b18]',
          !lifted && 'hover:-translate-y-0.5 active:scale-[0.985]',
          selected && '!border-[color:var(--tb-role)] shadow-[0_0_0_1px_var(--tb-role),0_0_28px_-6px_var(--tb-role)]',
          slot && !selected && 'opacity-60',
          lifted && '!opacity-100',
        )}
        style={{ ...roleStyle(player), touchAction: variant === 'rail' ? 'pan-y' : 'pan-x' }}
        data-variant={variant}
      >
        {/* Lifted, the card leaves a dashed outline behind: the ghost is the card now. No fade on
            the way back, or the card would blink in after the ghost has already gone. */}
        <span className={clsx('block', lifted && 'opacity-0')}>
          <CardFace player={player} variant={variant} position={slot?.code} />
        </span>
        {lifted && (
          <span
            aria-hidden="true"
            className="absolute inset-1 rounded-xl border border-dashed border-[color:var(--tb-role)] opacity-60"
          />
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[color:var(--tb-role)]"
        />
      </button>
    </li>
  );
});
