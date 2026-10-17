import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE, VIEWPORT } from '../../lib/motion.js';

/**
 * Headline that rises word by word out of a clipping mask.
 *
 * The mask is the whole effect: each word sits in an `overflow-hidden` span and
 * starts translated fully below it, so the words appear to be pushed up from
 * behind a solid edge rather than fading in place.
 *
 * `pb`/`mr` on the mask exist because descenders (g, y, p) and italics would
 * otherwise be clipped by the very overflow that makes the effect work.
 */
export default function SplitHeading({
  text,
  as = 'h2',
  className = '',
  delay = 0,
  stagger = 0.06,
  once = true,
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as] ?? motion.h2;
  const words = String(text).split(' ').filter(Boolean);

  if (reduced) {
    const Plain = as;
    return <Plain className={className}>{text}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ ...VIEWPORT, once }}
      variants={{ hidden: {}, show: { transition: { delayChildren: delay, staggerChildren: stagger } } }}
      aria-label={text}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="mr-[0.24em] inline-block overflow-hidden pb-[0.1em] align-bottom"
        >
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: '110%' },
              show: { y: '0%', transition: { duration: DURATION.epic, ease: EASE.luxe } },
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
