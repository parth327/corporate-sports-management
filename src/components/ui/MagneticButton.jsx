import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useGraphicsTier } from '../../lib/hooks.js';

/**
 * A button that leans toward the cursor.
 *
 * Deliberately inert on touch devices and under reduced-motion: on a phone the
 * pull would only ever fire mid-tap, which reads as a misfire rather than a
 * flourish. Everything still works as a plain anchor/button in that case.
 */
export default function MagneticButton({
  children,
  href,
  onClick,
  className = '',
  strength = 0.35,
  type = 'button',
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { coarse } = useGraphicsTier();
  const enabled = !reduced && !coarse;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  const onPointerMove = (e) => {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const Tag = href ? motion.a : motion.button;

  return (
    <Tag
      ref={ref}
      href={href}
      type={href ? undefined : type}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      style={enabled ? { x: springX, y: springY } : undefined}
      whileHover={enabled ? { scale: 1.03 } : undefined}
      whileTap={{ scale: 0.97 }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}
