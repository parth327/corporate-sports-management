/**
 * Visual identity for the things the console is about.
 *
 * The console is a working tool, so imagery earns its place by carrying
 * information rather than decorating: a photograph tells you at a glance which
 * competition a screen is scoped to, which is otherwise a word you have to
 * read. That is why it appears on sub-group-scoped surfaces and on empty
 * states, and nowhere near a data table or a form field.
 *
 * Matching is on the sub-group NAME rather than its id, because sub-groups are
 * user-defined master data — a fresh install or a renamed row would otherwise
 * point at nothing. Anything unrecognised falls back to a neutral stadium, so
 * a newly created sub-group is never broken, just generic.
 */

export interface SportLook {
  /** Wide image for banners. */
  image: string;
  /** Second image for stacked or split treatments. */
  alt: string;
  /** Written for a screen reader, not a caption. */
  description: string;
  /** Accent token from the validated palette. */
  accent: 'magenta' | 'azure' | 'solar' | 'phthalo';
  glyph: string;
}

const GENERIC: SportLook = {
  image: '/images/stadium-illustrated.jpg',
  alt: '/images/stadium-day.jpg',
  description: 'An illustrated stadium',
  accent: 'azure',
  glyph: '◇',
};

const LOOKS: { match: RegExp; look: SportLook }[] = [
  {
    match: /cricket/i,
    look: {
      image: '/images/cricket-night.jpg',
      alt: '/images/cricket-stumps.jpg',
      description: 'A cricket ground under floodlights',
      accent: 'magenta',
      glyph: '◈',
    },
  },
  {
    match: /football|soccer/i,
    look: {
      image: '/images/football-sunlit.jpg',
      alt: '/images/football-goalline.jpg',
      description: 'A sunlit football pitch',
      accent: 'phthalo',
      glyph: '⬢',
    },
  },
  {
    match: /cultural/i,
    look: {
      image: '/images/stadium-day.jpg',
      alt: '/images/trophy-lights.jpg',
      description: 'A full ground on a clear day',
      accent: 'solar',
      glyph: '✦',
    },
  },
];

export function sportLook(subGroupName?: string | null): SportLook {
  if (!subGroupName) return GENERIC;
  return LOOKS.find((entry) => entry.match.test(subGroupName))?.look ?? GENERIC;
}

/** Tailwind classes per accent, so callers never interpolate a class name. */
export const ACCENT_CLASSES: Record<SportLook['accent'], { text: string; border: string; bg: string }> = {
  magenta: { text: 'text-accent-magenta', border: 'border-magenta-500/35', bg: 'bg-magenta-500/[0.07]' },
  azure: { text: 'text-accent-azure', border: 'border-azure-500/35', bg: 'bg-azure-500/[0.07]' },
  solar: { text: 'text-accent-solar', border: 'border-solar-500/35', bg: 'bg-solar-500/[0.07]' },
  phthalo: { text: 'text-accent-phthalo', border: 'border-phthalo-500/35', bg: 'bg-phthalo-500/[0.07]' },
};
