import { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { DURATION, EASE } from '../../lib/motion.js';

const format = (n, prefix, suffix) => `${prefix}${Math.round(n).toLocaleString('en-IN')}${suffix}`;

/**
 * Number that counts up the first time it scrolls into view.
 *
 * The value is written straight to the node's textContent from the animation
 * frame rather than through React state — a two-second count-up at 60fps is a
 * hundred and twenty re-renders of a subtree for one string that nothing else
 * in the tree depends on. Assistive tech reads the final figure from a hidden
 * twin, never the intermediate ones.
 */
export default function Counter({ value, suffix = '', prefix = '', className = '', duration = 1.8 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (!inView) {
      node.textContent = format(0, prefix, suffix);
      return undefined;
    }

    if (reduced) {
      node.textContent = format(value, prefix, suffix);
      return undefined;
    }

    const controls = animate(0, value, {
      duration: duration || DURATION.slow,
      ease: EASE.luxe,
      onUpdate: (v) => {
        node.textContent = format(v, prefix, suffix);
      },
    });

    return () => controls.stop();
  }, [inView, value, suffix, prefix, duration, reduced]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{format(value, prefix, suffix)}</span>
    </span>
  );
}
