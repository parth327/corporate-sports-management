import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Hairline read-out of how far through the season page you are.
 *
 * Driven by a spring rather than the raw scroll value so a flick of the wheel
 * arrives as a swell instead of a jump. `scaleX` only — animating width would
 * put a layout pass on every frame of the scroll.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-spectrum"
      aria-hidden="true"
    />
  );
}
