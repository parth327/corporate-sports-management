import { useEffect, useLayoutEffect, type CSSProperties } from 'react';
import { motion, useReducedMotion, useSpring, useTransform, useVelocity } from 'framer-motion';
import { PLAYER_BY_ID, ROLE_COLOR } from '../data/squad';
import { useBuilder } from '../store/builderStore';
import { drag, ghost } from '../store/spatialBridge';
import { CardFace, PlayerChip } from './PlayerFace';

/*
 * Position: a little under-damped and heavy, so the card trails the finger
 * and settles with a hint of overshoot, like an object with mass rather than
 * a cursor. Tilt: softer again, so it swings rather than snaps. With reduced
 * motion: over-damped and fast, and no tilt at all.
 */
const POSITION = { stiffness: 560, damping: 40, mass: 1 };
const POSITION_STILL = { stiffness: 900, damping: 90, mass: 1 };
const MORPH = { stiffness: 320, damping: 30 };
const TILT = { stiffness: 240, damping: 24 };

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The chip diameter, from the same custom property the slot chips are sized by (46px on phones, 52 otherwise). */
function chipSize(): number {
  const root = document.querySelector('.tb-root') ?? document.documentElement;
  return Number.parseFloat(getComputedStyle(root).getPropertyValue('--tb-chip')) || 52;
}

/**
 * The card in the air.
 *
 * The drag controller sets targets on these springs every frame (the
 * pointer, a node's projected point, a card's home) and Framer does the
 * physics. Velocity drives the tilt: the card leans into the direction it is
 * thrown and rolls with it, and it straightens as it slows. Over a node it
 * condenses from the card into the round chip that the slot then shows, so
 * the 2D element becomes the 3D node's token without a cut.
 */
export function DragGhost() {
  const id = useBuilder((s) => s.dragging ?? s.flight);
  const dragging = useBuilder((s) => s.dragging !== null);
  const player = id ? PLAYER_BY_ID.get(id) : undefined;
  const reduced = useReducedMotion() ?? false;

  const x = useSpring(0, reduced ? POSITION_STILL : POSITION);
  const y = useSpring(0, reduced ? POSITION_STILL : POSITION);
  const morph = useSpring(0, MORPH);

  /* Hand these springs to the controller, and take them back on unmount. */
  useLayoutEffect(() => {
    const previous = { x: ghost.x, y: ghost.y, morph: ghost.morph };
    ghost.x = x;
    ghost.y = y;
    ghost.morph = morph;
    return () => {
      ghost.x = previous.x;
      ghost.y = previous.y;
      ghost.morph = previous.morph;
    };
  }, [x, y, morph]);

  const vx = useVelocity(x);
  const vy = useVelocity(y);
  const lean = (range: [number, number]) => (v: number) =>
    reduced ? 0 : mix(range[0], range[1], (Math.max(-2600, Math.min(2600, v)) + 2600) / 5200);
  const rotateZ = useSpring(useTransform(vx, lean([-11, 11])), TILT);
  const rotateY = useSpring(useTransform(vx, lean([-24, 24])), TILT);
  const rotateX = useSpring(useTransform(vy, lean([20, -20])), TILT);

  /* Held cards grow a touch; released, they settle back to true size before they land, so the handoff is flush. */
  const lift = useSpring(1, TILT);
  useEffect(() => {
    lift.set(dragging && !reduced ? 1.045 : 1);
  }, [lift, dragging, reduced]);

  const chip = chipSize();
  const width = useTransform([morph, ghost.width], ([m, w]: number[]) => mix(w ?? 280, chip, m ?? 0));
  const height = useTransform([morph, ghost.height], ([m, h]: number[]) => mix(h ?? 76, chip, m ?? 0));
  const radius = useTransform(morph, (m) => mix(16, chip / 2, m));
  const face = useTransform(morph, [0, 0.45], [1, 0]);
  const token = useTransform(morph, [0.45, 0.9], [0, 1]);
  const tokenScale = useTransform(morph, [0.45, 1], [0.7, 1]);
  /* The card's own glass, shadow and rim fade out as it condenses, so the last frame is the bare chip the slot shows. */
  const fill = useTransform(morph, [0, 0.55, 1], [0.97, 0.9, 0]);
  const background = useTransform(fill, (a) => `rgba(10, 17, 34, ${a.toFixed(3)})`);
  const boxShadow = useTransform(morph, (m) => {
    const s = 1 - m;
    return `0 ${28 * s}px ${60 * s}px -12px rgba(0,0,0,${0.55 * s}), 0 0 0 1px rgba(255,255,255,${0.14 * s}), 0 0 ${36 * s}px -8px var(--tb-role)`;
  });

  if (!player) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{ x, y, perspective: 900, '--tb-role': ROLE_COLOR[player.role] } as unknown as CSSProperties}
    >
      <motion.div
        className="tb-fs-body absolute left-0 top-0 overflow-hidden text-white"
        style={{
          width,
          height,
          borderRadius: radius,
          background,
          boxShadow,
          x: '-50%',
          y: '-50%',
          rotateX,
          rotateY,
          rotateZ,
          scale: lift,
        }}
      >
        {/* Card-sized and centred, so the shrinking frame crops it toward the middle as it becomes the chip. */}
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{ opacity: face, width: ghost.width, height: ghost.height, x: '-50%', y: '-50%' }}
        >
          <CardFace player={player} variant={drag.variant} />
        </motion.div>
        <motion.div className="absolute inset-0 grid place-items-center" style={{ opacity: token, scale: tokenScale }}>
          <PlayerChip player={player} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
