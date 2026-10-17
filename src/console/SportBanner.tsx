import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ACCENT_CLASSES, sportLook } from './sportImagery';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * A photographic strip identifying the competition a screen is scoped to.
 *
 * Three things make this safe to put above working screens rather than
 * decorative:
 *
 *   1. It is short and fixed-height, so it never pushes the actual work below
 *      the fold on a laptop.
 *   2. The photograph is `aria-hidden` and carries no information that is not
 *      also in the text beside it — a screen-reader user loses nothing.
 *   3. It renders the text immediately and fades the image in behind it when
 *      it loads, so a slow image never delays the heading or leaves white
 *      text on a white gap.
 */
export function SportBanner({
  subGroupName,
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  subGroupName?: string | null;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const look = sportLook(subGroupName);
  const accent = ACCENT_CLASSES[look.accent];
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.luxe }}
      className={clsx(
        'relative mb-6 overflow-hidden rounded-2xl border border-fg/12 bg-surface-raised',
        className,
      )}
    >
      {/* The photograph, and a scrim heavy enough that the text below clears
          AA against it whatever the image happens to be doing at that point. */}
      <div aria-hidden="true" className="absolute inset-0">
        <motion.img
          src={look.image}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.06 }}
          transition={{ duration: 0.9, ease: EASE.luxe }}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/92 to-ink-900/55" />
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-7 sm:py-8">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 font-mono text-[11.5px] uppercase tracking-hud text-solar-300">
              {eyebrow}
            </p>
          )}
          <h1 className="flex items-center gap-2.5 font-display text-2xl leading-tight tracking-tightest text-white sm:text-3xl">
            <span aria-hidden="true" className={clsx('text-[0.7em]', accent.text)}>
              {look.glyph}
            </span>
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/78">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.header>
  );
}
