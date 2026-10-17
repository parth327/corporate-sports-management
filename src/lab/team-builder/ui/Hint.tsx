import { AnimatePresence, motion } from 'framer-motion';
import { FORMATIONS, PLAYER_BY_ID } from '../data/squad';
import { useBuilder } from '../store/builderStore';

/**
 * One line of guidance at the foot of the pitch, rewritten for whatever the
 * visitor is in the middle of: the idle how-to, a player in hand, a position
 * waiting for a player.
 */
export function Hint({ touch }: { touch: boolean }) {
  const selected = useBuilder((s) => s.selected);
  const targetSlot = useBuilder((s) => s.targetSlot);
  const formation = useBuilder((s) => s.formation);
  const dragging = useBuilder((s) => s.dragging);

  const holding = selected ? PLAYER_BY_ID.get(selected) : undefined;
  const target = targetSlot >= 0 ? FORMATIONS[formation][targetSlot] : undefined;
  const text = holding
    ? `${touch ? 'Tap' : 'Click'} a position for ${holding.name} · Esc to cancel`
    : target
      ? `Now pick a player for ${target.name.toLowerCase()} · Esc to cancel`
      : touch
        ? 'Drag a card onto a node, or tap a node first'
        : 'Drag a player onto a glowing node · flick to throw · double-click the pitch to recentre';

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!dragging && (
        <motion.p
          key={text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="tb-glass tb-fs-small pointer-events-none mx-auto w-fit max-w-full rounded-full px-4 py-2 text-center text-white/85"
        >
          {text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
