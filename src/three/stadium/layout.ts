/**
 * Procedural stadium geometry, as plain numbers.
 *
 * Kept free of React so the maths can be reasoned about (and tested) on its
 * own. World units are metres; the field is an ellipse centred on the origin
 * and every stand element is placed by an outward offset `d` from its edge.
 */

export const TAU = Math.PI * 2;

/** Semi-axes of the playing surface (x across, z along the strip). */
export const FIELD = { rx: 46, rz: 36 } as const;

/** Radial offset (from the field edge) and height of each stand feature. */
export const BOWL = {
  apron: 2,
  wall: 4,
  lowerTop: { d: 22, h: 12 },
  concourse: { d: 24, h: 12.5, wall: 14 },
  upperTop: { d: 40, h: 30 },
  crown: { d: 41, h: 32 },
  outer: 42,
} as const;

export const ROOF = { inner: { d: 26, h: 38 }, outer: { d: 44, h: 35 } } as const;

export const TOWER = { d: 48, height: 62, headWidth: 12, headHeight: 7 } as const;

export function ellipseX(theta: number, d: number): number {
  return (FIELD.rx + d) * Math.cos(theta);
}

export function ellipseZ(theta: number, d: number): number {
  return (FIELD.rz + d) * Math.sin(theta);
}

/** Ramanujan's approximation of an ellipse perimeter. */
export function perimeter(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** Seeded PRNG (mulberry32) so the crowd is identical on every load. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Sections — the stands are a pie chart of the Colour League
 * ------------------------------------------------------------------ */

export interface Section {
  /** Start and end angle, radians, counter-clockwise from +x. */
  from: number;
  to: number;
  hex: string;
  label: string;
}

/** One stand section per division, its arc proportional to that division's league points. */
export function sectionsFromStandings(
  rows: readonly { division: string; hex: string; points: number }[],
  startAngle = Math.PI / 2,
): Section[] {
  const total = rows.reduce((sum, r) => sum + r.points, 0) || 1;
  let cursor = startAngle;
  return rows.map((row) => {
    const span = (row.points / total) * TAU;
    const section = { from: cursor, to: cursor + span, hex: row.hex, label: row.division };
    cursor += span;
    return section;
  });
}

export function sectionIndexAt(sections: readonly Section[], theta: number): number {
  const start = sections[0]?.from ?? 0;
  const t = (((theta - start) % TAU) + TAU) % TAU + start;
  const index = sections.findIndex((s) => t >= s.from && t < s.to);
  return index < 0 ? sections.length - 1 : index;
}

/* ------------------------------------------------------------------ *
 * Seats
 * ------------------------------------------------------------------ */

export interface SeatLayoutOptions {
  sections: readonly Section[];
  /** Metres between rows along the rake. Larger = fewer seats. */
  rowSpacing: number;
  /** Metres between seat centres along a row. */
  seatSpacing: number;
  seed?: number;
}

export interface SeatLayout {
  count: number;
  /** 16 floats per seat, column-major, ready for InstancedMesh.instanceMatrix. */
  matrices: Float32Array;
  /** Linear-space RGB per seat (the section's colour with a little variation). */
  colors: Float32Array;
  /** Per seat: angle around the bowl 0..1, random seed, height in the bowl 0..1, section index. */
  params: Float32Array;
}

interface Tier {
  d0: number;
  h0: number;
  d1: number;
  h1: number;
}

const TIERS: Tier[] = [
  { d0: BOWL.wall + 0.6, h0: 1.2, d1: BOWL.lowerTop.d, h1: BOWL.lowerTop.h },
  { d0: BOWL.concourse.d + 0.6, h0: BOWL.concourse.wall, d1: BOWL.upperTop.d, h1: BOWL.upperTop.h },
];

/** Angular half-width of the gangway between sections at a given radius. */
const gangway = (radius: number) => 1.6 / radius;

export function buildSeatLayout(
  { sections, rowSpacing, seatSpacing, seed = 1959 }: SeatLayoutOptions,
  hexToLinear: (hex: string) => [number, number, number],
): SeatLayout {
  const rand = prng(seed);
  const pigments = sections.map((s) => hexToLinear(s.hex));

  const matrices: number[] = [];
  const colors: number[] = [];
  const params: number[] = [];
  const maxHeight = BOWL.upperTop.h;

  for (const tier of TIERS) {
    const slope = (tier.h1 - tier.h0) / (tier.d1 - tier.d0);
    const rows = Math.floor((tier.d1 - tier.d0) / rowSpacing);

    for (let row = 0; row < rows; row += 1) {
      const d = tier.d0 + (row + 0.5) * rowSpacing;
      const h = tier.h0 + (d - tier.d0) * slope + 0.28;
      const a = FIELD.rx + d;
      const b = FIELD.rz + d;
      const seatsInRow = Math.floor(perimeter(a, b) / seatSpacing);
      const radius = (a + b) / 2;
      const gap = gangway(radius);

      for (let i = 0; i < seatsInRow; i += 1) {
        const theta = (i / seatsInRow) * TAU;

        const k = sectionIndexAt(sections, theta);
        const section = sections[k]!;
        const t = (((theta - section.from) % TAU) + TAU) % TAU;
        const span = section.to - section.from;
        if (t < gap || t > span - gap) continue;

        const x = a * Math.cos(theta);
        const z = b * Math.sin(theta);
        /* Face along the inward normal of the ellipse, not at the centre, so rows stay parallel to the edge. */
        const nx = Math.cos(theta) / a;
        const nz = Math.sin(theta) / b;
        const yaw = Math.atan2(-nx, -nz);
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);

        matrices.push(cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, x, h, z, 1);

        const pigment = pigments[k]!;
        const shade = 0.72 + rand() * 0.5;
        colors.push(pigment[0] * shade, pigment[1] * shade, pigment[2] * shade);
        params.push(theta / TAU, rand(), h / maxHeight, k);
      }
    }
  }

  return {
    count: colors.length / 3,
    matrices: new Float32Array(matrices),
    colors: new Float32Array(colors),
    params: new Float32Array(params),
  };
}

/* ------------------------------------------------------------------ *
 * The bowl, as one extruded profile
 * ------------------------------------------------------------------ */

/** A cross-section segment of the stand and the colour baked onto it. */
export interface ProfileSegment {
  from: [d: number, h: number];
  to: [d: number, h: number];
  /** Linear RGB at the inner/lower end and outer/upper end. */
  shade: [[number, number, number], [number, number, number]];
}

export interface BuiltGeometry {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/**
 * Sweeps a profile around the field ellipse. Each segment gets its own
 * vertices so the baked colour changes sharply at a corner instead of
 * smearing across it.
 */
export function sweepProfile(
  profile: readonly ProfileSegment[],
  segments: number,
  lightAt: (theta: number) => number,
): BuiltGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const seg of profile) {
    const base = positions.length / 3;
    for (let i = 0; i <= segments; i += 1) {
      const theta = (i / segments) * TAU;
      const light = lightAt(theta);
      for (const [end, [d, h]] of [seg.from, seg.to].entries()) {
        positions.push(ellipseX(theta, d), h, ellipseZ(theta, d));
        const c = seg.shade[end]!;
        colors.push(c[0] * light, c[1] * light, c[2] * light);
      }
    }
    for (let i = 0; i < segments; i += 1) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}

/** Floodlight towers sit on the diagonals, outside the bowl. */
export function towerPositions(): [number, number, number][] {
  return [0, 1, 2, 3].map((k) => {
    const theta = Math.PI / 4 + (k * Math.PI) / 2;
    return [ellipseX(theta, TOWER.d), TOWER.height, ellipseZ(theta, TOWER.d)];
  });
}

/** Where each tower's beam lands on the grass: part-way from the tower toward the centre. */
export function beamTargets(): [number, number][] {
  return towerPositions().map(([x, , z]) => [x * 0.18, z * 0.18]);
}
