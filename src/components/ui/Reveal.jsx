import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE, VIEWPORT } from '../../lib/motion.js';

/**
 * The single scroll-reveal primitive every section uses.
 *
 * Centralising it is what stops the page from feeling like fifteen separate
 * animations: one curve, one distance, one trigger point. Under reduced-motion
 * it degrades to a plain fade with no travel, rather than being switched off —
 * the content still announces itself, it just stops moving.
 */
export default function Reveal({
  children,
  as = 'div',
  delay = 0,
  y = 28,
  blur = true,
  className = '',
  viewport = VIEWPORT,
  ...rest
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as] ?? motion.div;

  const hidden = reduced
    ? { opacity: 0 }
    : { opacity: 0, y, filter: blur ? 'blur(8px)' : 'blur(0px)' };

  const show = reduced
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: 'blur(0px)' };

  return (
    <MotionTag
      initial={hidden}
      whileInView={show}
      viewport={viewport}
      transition={{ duration: DURATION.slow, ease: EASE.luxe, delay }}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
