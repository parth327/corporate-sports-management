import { useEffect, useRef, type RefObject } from 'react';
import { useDrag } from '@use-gesture/react';
import { beginDrag, cancelDrag, endDrag, moveDrag } from '../interaction/dragController';
import type { DragSource } from '../store/builderStore';
import { drag } from '../store/spatialBridge';

/**
 * Binds @use-gesture's drag to the controller.
 *
 * `scrollAxis` is the axis the card's list scrolls along, if any. On touch,
 * a swipe along it scrolls the list as usual; the drag begins on a swipe
 * across it, or after a short press, which is the only way a card in a
 * scrolling list can be both scrollable and draggable with one finger. The
 * element's `touch-action` must allow the same axis (`pan-y` for `'y'`).
 *
 * A drag begins only after 6px of movement, so a click, a tap or Enter all
 * reach the element's own click handler, and the one click a browser fires
 * after a real drag is dropped by `isDragClick`. use-gesture's `filterTaps`
 * is deliberately not used: combined with the touch scroll handling above, a
 * quick tap never activates the gesture, the tap is never recorded, and its
 * click guard then swallows the click, so tapping a card on a phone did
 * nothing. Arrow keys are left to the page: use-gesture would otherwise turn
 * them into drags.
 *
 * Each binding owns its drag. Events from a gesture that does not own the
 * current drag (a second finger, or a drag already ended by Escape) are
 * ignored, and if the element unmounts mid-drag (a layout change, a filter
 * tapped by another finger) the drag is cancelled rather than left stranded
 * without its pointer capture.
 */
export function useCardDrag(
  ref: RefObject<HTMLElement>,
  playerId: string,
  source: DragSource,
  scrollAxis: 'x' | 'y' | null,
) {
  const owner = useRef({}).current;

  useEffect(
    () => () => {
      if (drag.owner === owner) cancelDrag();
    },
    [owner],
  );

  return useDrag(
    ({ first, last, xy: [x, y], velocity: [speedX, speedY], direction: [dirX, dirY], canceled, event }) => {
      if (first) {
        const el = ref.current;
        if (el) beginDrag(owner, playerId, source, el, x, y);
      }
      if (drag.owner !== owner) {
        /* Not ours, or already cancelled: still swallow the click that follows the release. */
        if (last) drag.quietUntil = performance.now() + 350;
        return;
      }
      const vx = speedX * dirX;
      const vy = speedY * dirY;
      moveDrag(x, y, vx, vy);
      if (last) {
        /* The browser took the gesture (a scroll, a system swipe) or capture was lost: not a drop. */
        const interrupted = canceled || event.type === 'pointercancel' || event.type === 'lostpointercapture';
        endDrag(x, y, vx, vy, interrupted);
      }
    },
    {
      threshold: 6,
      pointer: { keys: false },
      ...(scrollAxis ? { preventScroll: 180, preventScrollAxis: scrollAxis } : { preventScroll: false }),
    },
  );
}
