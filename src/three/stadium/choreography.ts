/**
 * The camera's route through the page.
 *
 * Each shot is anchored to a section of the landing page by its element id.
 * The camera arrives at a shot when that section's top reaches the focus line,
 * so the choreography stays locked to the copy at every viewport size instead
 * of drifting with document height.
 */

export interface Shot {
  /** Id of the section this shot belongs to, without the hash. */
  anchor: string;
  /** Chapter name shown in the page's chapter rail. */
  chapter: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** 0..1 — how lively the crowd is: wave height and camera-flash rate. */
  excite: number;
  /** Pulse the league leader's stand while this shot holds. */
  highlightLeader?: boolean;
  /** Taken from inside the bowl: portrait screens widen the lens instead of pulling back through the stands. */
  interior?: boolean;
}

/*
 * Every position either sits inside the bowl or high enough that the line of
 * sight clears the 32 m crown — an exterior-only view is a black wall at night.
 */
export const SHOTS: Shot[] = [
  { anchor: 'top', chapter: 'Kick-off', position: [-200, 158, 262], target: [0, 4, 4], fov: 34, excite: 0.35 },
  { anchor: 'about-ici', chapter: 'The company', position: [-52, 64, 118], target: [22, 8, -18], fov: 44, excite: 0.25 },
  { anchor: 'about', chapter: 'Values', position: [52, 9, 16], target: [30, 8, -43], fov: 52, excite: 0.5, interior: true },
  { anchor: 'heritage', chapter: 'Since 2001', position: [40, 50, -62], target: [-18, 6, 8], fov: 48, excite: 0.3 },
  { anchor: 'events', chapter: 'The season', position: [0, 3.4, 30], target: [0, 6, -60], fov: 54, excite: 0.45, interior: true },
  { anchor: 'spotlight', chapter: 'Flagships', position: [56, 52, 48], target: [-22, 0, -16], fov: 48, excite: 0.55 },
  { anchor: 'calendar', chapter: 'Calendar', position: [-70, 34, -20], target: [12, 4, 10], fov: 46, excite: 0.3, interior: true },
  { anchor: 'standings', chapter: 'Colour League', position: [0, 236, 34], target: [0, 0, 0], fov: 40, excite: 1, highlightLeader: true },
  { anchor: 'gallery', chapter: 'The archive', position: [128, 96, 112], target: [0, 2, 0], fov: 40, excite: 0.6 },
  { anchor: 'register', chapter: 'Take part', position: [0, 112, 236], target: [0, 8, 0], fov: 36, excite: 0.8 },
];

/**
 * Scroll offsets at which each shot is fully arrived, given each section's
 * document top. Monotonic by construction, so a section that renders shorter
 * than expected can never make the camera run backwards.
 */
export function arrivalOffsets(sectionTops: (number | null)[], viewport: number, focus = 0.45): number[] {
  const out: number[] = [];
  let previous = 0;
  sectionTops.forEach((top, i) => {
    const arrive = i === 0 ? 0 : Math.max(previous, (top ?? previous) - viewport * focus);
    out.push(arrive);
    previous = arrive;
  });
  return out;
}

const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * Continuous shot index for a scroll position. Integer values sit exactly on a
 * shot; the fraction between two shots is eased so the camera settles while a
 * section is being read and travels between sections.
 */
export function shotProgress(scrollY: number, arrivals: number[]): number {
  const last = arrivals.length - 1;
  if (last <= 0) return 0;
  if (scrollY <= arrivals[0]!) return 0;
  for (let i = 0; i < last; i += 1) {
    const from = arrivals[i]!;
    const to = arrivals[i + 1]!;
    if (scrollY < to) {
      const span = to - from;
      const raw = span > 0 ? (scrollY - from) / span : 1;
      return i + smootherstep(Math.min(Math.max(raw, 0), 1));
    }
  }
  return last;
}

/** Index of the chapter currently on screen: the nearest shot, rounding at the midpoint. */
export function chapterAt(progress: number): number {
  return Math.min(Math.max(Math.round(progress), 0), SHOTS.length - 1);
}
