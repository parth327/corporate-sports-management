import { useRef } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import type { Sport } from './PlayerCard';

/**
 * The player badge.
 *
 * Replaces the earlier WebGL figure. That approach cost a lazy three.js
 * chunk to paint a stylised mannequin that read as a toy next to the rest of
 * the console's typography-led design language — the wrong trade for an
 * admin tool a moderator opens dozens of times a session. This is CSS and
 * Framer Motion only: a mouse-tracked tilt, a soft pointer-lit spotlight,
 * and a slow-drifting aurora built from the same colour palette as
 * everywhere else in the app, so an "participant card" finally looks like it
 * belongs to the same product as the dashboard around it.
 */

const SPORT_META: Record<Sport, { label: string; glyph: JSX.Element }> = {
  cricket: {
    label: 'Cricket · Colour League',
    glyph: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19L15 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="13.5" y="4.5" width="4.2" height="10" rx="1.6" transform="rotate(45 15.6 9.6)" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="6" cy="18" r="2.1" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  football: {
    label: 'Football · Colour League',
    glyph: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7.2l3.6 2.6-1.4 4.2h-4.4L8.4 9.8 12 7.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M12 4v3.2M4.6 9.4l2.6 1.2M6.2 18l2.6-3M17.8 18l-2.6-3M19.4 9.4l-2.6 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  creative: {
    label: 'Cultural · Colour League',
    glyph: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4.5c-4.4 0-8 2.9-8 6.9 0 2.7 2.1 4.1 4.2 4.1h1.1c.7 0 1.2.6 1.2 1.2 0 .4-.2.7-.4 1-.3.3-.4.6-.4 1 0 1 1 1.8 2.3 1.8 4.4 0 8-3.9 8-8.7 0-3.9-3.6-7.3-8-7.3z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="10" r="1.1" fill="currentColor" />
        <circle cx="12.5" cy="8" r="1.1" fill="currentColor" />
        <circle cx="15.5" cy="10.5" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
};

/** Two-letter monogram, the same rule the console nav avatar already uses. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = Number.parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

interface PlayerBadgeProps {
  name: string;
  sport: Sport;
  color: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral';
}

export function PlayerBadge({ name, sport, color, statusTone }: PlayerBadgeProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const meta = SPORT_META[sport];
  const [r, g, b] = hexToRgb(color);

  /* Raw pointer targets, 0–1 across the card, and the tilt angles in
     degrees. Every one of these is sprung on the way out — set the raw
     value on move, read the sprung value in render — so the tilt and the
     spotlight settle together instead of snapping ahead of the pointer. */
  const spring = { stiffness: 220, damping: 24, mass: 0.6 };

  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const sx = useSpring(rawX, spring);
  const sy = useSpring(rawY, spring);

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, spring);
  const rotateY = useSpring(rawRotateY, spring);

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    rawX.set(x);
    rawY.set(y);
    /* Subtle range — a premium tilt reads as material, not a gimmick. */
    rawRotateY.set((x - 0.5) * 12);
    rawRotateX.set((0.5 - y) * 12);
  };

  const onLeave = () => {
    rawX.set(0.5);
    rawY.set(0.5);
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  const spotlightBg = useMotionTemplate`radial-gradient(320px circle at ${sx}% ${sy}%, rgba(255,255,255,0.16), transparent 62%)`;

  const STATUS_DOT: Record<PlayerBadgeProps['statusTone'], string> = {
    success: '#22BC8A',
    warning: '#D9AC00',
    danger: '#DB55A5',
    neutral: '#8A8394',
  };

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          rotateX: reduceMotion ? 0 : rotateX,
          rotateY: reduceMotion ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/16"
      >
        {/* Base wash — the team colour, dark at the edges so text stays legible.
            Fixed-dark by design regardless of site theme — this is a "physical
            trading card" surface, not the page background, so it does not use
            the fg/surface tokens the rest of the console does. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 50% 8%, rgba(${r},${g},${b},0.38), transparent 60%), linear-gradient(175deg, #232130 0%, #1A1826 78%)`,
          }}
        />

        {/* Aurora — two soft, slow-drifting blobs in the brand palette. */}
        {!reduceMotion && (
          <>
            <motion.div
              aria-hidden="true"
              className="absolute -left-10 -top-10 h-44 w-44 rounded-full blur-3xl"
              style={{ background: `rgba(${r},${g},${b},0.45)` }}
              animate={{ x: [0, 18, -6, 0], y: [0, 10, -14, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              aria-hidden="true"
              className="absolute -bottom-14 -right-8 h-52 w-52 rounded-full bg-azure-500/30 blur-3xl"
              animate={{ x: [0, -14, 10, 0], y: [0, -12, 8, 0] }}
              transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        {/* Fine grid, so the surface reads as engineered rather than a flat gradient. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* Pointer-lit spotlight — the one effect that only exists on hover. */}
        {!reduceMotion && (
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: spotlightBg }} />
        )}

        {/* Status pulse, top-right. */}
        <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full"
              style={{ backgroundColor: STATUS_DOT[statusTone] }}
            />
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_DOT[statusTone] }}
            />
          </span>
        </div>

        {/* The monogram — the card's centrepiece, on its own depth layer so
            the tilt gives it real parallax against the background. */}
        <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6" style={{ transform: 'translateZ(40px)' }}>
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-full opacity-70 blur-md"
              style={{ background: `conic-gradient(from 0deg, ${color}, #2475B7, #FFCB00, ${color})` }}
            />
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-full opacity-90"
              style={{ background: `conic-gradient(from 0deg, ${color}, #2475B7, #FFCB00, ${color})` }}
            />
            <span className="relative grid h-24 w-24 place-items-center rounded-full border border-white/20 bg-ink-900/85 backdrop-blur-sm sm:h-28 sm:w-28">
              <span className="font-display text-3xl tracking-tightest text-white sm:text-4xl">
                {initials(name)}
              </span>
            </span>
          </div>

          <p className="text-center text-[13px] font-semibold leading-snug text-white/92 sm:text-[14px]">
            {name}
          </p>
        </div>

        {/* Sport pill, bottom strip — same information the old figure's
            caption carried, minus the three.js cost of carrying it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-ink-900/92 to-transparent p-3.5">
          <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-ink-900/70 px-3 py-1.5 text-[11.5px] font-semibold text-white/88 backdrop-blur">
            <span className="text-white/75">{meta.glyph}</span>
            {meta.label}
          </span>
        </div>

        {/* Edge highlight — a hairline that only appears on hover, the cheapest
            possible way to say "this is a surface, not a flat image". */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/0 transition-colors duration-300 group-hover:border-white/25" />
      </motion.div>
    </div>
  );
}
