/**
 * Shared motion vocabulary.
 *
 * Every animation on the site draws its easing and duration from here, which is
 * what makes a hover, a section reveal and a modal feel like the same product
 * rather than three different ones.
 */

export const EASE = {
  /* The house curve: fast out, long settle. Used for almost everything. */
  luxe: [0.22, 1, 0.36, 1],
  /* Symmetrical, for things that move both ways (accordions, tabs). */
  smooth: [0.65, 0, 0.35, 1],
  /* A touch of overshoot, reserved for small celebratory elements. */
  pop: [0.34, 1.56, 0.64, 1],
};

export const DURATION = {
  fast: 0.3,
  base: 0.55,
  slow: 0.9,
  epic: 1.4,
};

/**
 * Springs, for anything a pointer is holding.
 *
 * A drag has no known end time — the user decides it — so a duration-based
 * tween always arrives either ahead of or behind the cursor. These are the
 * two the console uses.
 */
export const SPRING = {
  /* Followed by the card under the cursor, and by rows sliding out of its way. */
  drag: { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 },
  /* Softer, for a card settling back into place after a drop. */
  settle: { type: 'spring', stiffness: 340, damping: 34, mass: 0.9 },
};

/* ---- Reveal variants ------------------------------------------------ */

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE.luxe },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.slow, ease: EASE.luxe } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.slow, ease: EASE.luxe },
  },
};

/** Parent wrapper that walks its children in one after another. */
export const stagger = (delayChildren = 0, staggerChildren = 0.08) => ({
  hidden: {},
  show: {
    transition: { delayChildren, staggerChildren },
  },
});

/** Word-by-word mask reveal — the hero headline treatment. */
export const wordRise = {
  hidden: { y: '110%' },
  show: {
    y: '0%',
    transition: { duration: DURATION.epic, ease: EASE.luxe },
  },
};

/** Shared viewport config so every section triggers at the same point. */
export const VIEWPORT = { once: true, amount: 0.2 };
export const VIEWPORT_EARLY = { once: true, amount: 0.05 };
