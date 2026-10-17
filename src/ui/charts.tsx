import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * Inline-SVG charts for the console.
 *
 * PALETTE — validated, do not reorder and do not extend by inventing a hue.
 * The four categorical steps below pass all six checks against the panel
 * surface #232130 (lightness band L 0.48–0.67, chroma floor, CVD separation
 * ΔE 9.0 worst adjacent pair, normal-vision ΔE 15.7, contrast ≥ 3:1). Three of
 * the four are the ACE logo colours; the yellow is stepped down to solar-700
 * because #FFCB00 sits far outside the band.
 *
 * Re-validated when the surface was lifted off near-black. Stepping the ramp
 * up to match the lighter panel looks like the obvious move and is wrong — at
 * magenta-400/phthalo-400 the palette leaves the lightness band. These steps
 * still clear 3:1 on the lighter surface, so they stay put.
 *
 * A ninth series is never a generated colour — it folds into "Other".
 */
export const CATEGORICAL = ['#C72D86', '#2475B7', '#A88500', '#00A170'] as const;

/** Reserved. Never reused as "series 5". Always shipped with a glyph + label. */
export const STATUS_COLORS = {
  good: '#00A170',
  info: '#2475B7',
  warning: '#A88500',
  critical: '#C72D86',
} as const;

/* Chart ink and grid, lifted with the surface. Axes stay recessive, but at the
   old 0.08 the grid disappeared entirely once the panel came off near-black.
   These read the same `--fg-rgb` custom property as the `fg` Tailwind token
   (see tailwind.config.js / index.css), so SVG fill/stroke attributes stay in
   sync with the rest of the page when the theme flips — no theme prop needed
   here, the browser resolves the variable against the cascade. */
const INK = {
  primary: 'rgb(var(--fg-rgb))',
  secondary: 'rgb(var(--fg-rgb) / 0.74)',
  muted: 'rgb(var(--fg-rgb) / 0.52)',
};
const GRID = 'rgb(var(--fg-rgb) / 0.14)';

export function seriesColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length]!;
}

/* ------------------------------------------------------------------ *
 * Shared chrome
 * ------------------------------------------------------------------ */

function ChartFrame({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    /* `min-w-0` because a grid item defaults to `min-width: auto` and is sized
       by its widest content. An SVG chart scales and never notices; a frame
       whose body is text — a legend row, a funnel label — pushes its own track
       wider than the viewport without it. */
    <figure className={clsx('glass flex min-w-0 flex-col rounded-2xl p-5', className)}>
      <figcaption className="mb-4">
        {/* h2, not h3. A chart panel is a peer of the Card sections around it
            and sits directly under the page h1 — an h3 here skipped a level
            and broke the heading outline a screen-reader user navigates by. */}
        <h2 className="text-[12px] font-bold uppercase tracking-[0.13em] text-fg/72">{title}</h2>
        {subtitle && <p className="mt-1 text-[12.5px] text-fg/58">{subtitle}</p>}
      </figcaption>
      <div className="min-w-0 flex-1">{children}</div>
      {footer && <div className="mt-3 border-t border-fg/14 pt-3">{footer}</div>}
    </figure>
  );
}

/** Tooltip that follows the hovered mark. */
function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      style={{ left: `${x}%`, top: `${y}%` }}
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-fg/22 bg-surface-raised/95 px-2.5 py-1.5 text-[12.5px] shadow-xl backdrop-blur"
    >
      {children}
    </div>
  );
}

/** Top-rounded bar anchored to the baseline — never rounded at the bottom. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, Math.max(h, 0));
  if (h <= 0) return '';
  return [
    `M${x},${y + h}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

/* ------------------------------------------------------------------ *
 * Stat tile — a hero number, not a chart
 * ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  caption,
  accent = CATEGORICAL[0],
  loading,
  to,
}: {
  label: string;
  value: number | string;
  caption?: string;
  accent?: string;
  loading?: boolean;
  /** Where the number leads. A count nobody can drill into is a dead end. */
  to?: string;
}) {
  const body = (
    <>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-fg/62">{label}</p>
      <p className="mt-2 font-display text-3xl leading-none tracking-tightest text-fg tabular-nums">
        {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-fg/12" /> : value}
      </p>
      {caption && (
        <p className="mt-1.5 text-[12.5px] text-fg/62">
          {caption}
          {to && <span className="ml-1 text-accent-solar">→</span>}
        </p>
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.luxe }}
      className="glass relative overflow-hidden rounded-2xl"
    >
      {to ? (
        <Link to={to} className="lift block h-full rounded-2xl p-4">
          {body}
        </Link>
      ) : (
        <div className="p-4">{body}</div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Bar chart — magnitude across named categories
 * ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  title,
  subtitle,
  data,
  valueLabel = 'registrations',
  className,
}: {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  valueLabel?: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">No data for this filter.</p>
      </ChartFrame>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 400;
  const H = 180;
  const padBottom = 28;
  const padTop = 20;
  const plot = H - padBottom - padTop;
  /* 2px surface gap between adjacent fills. */
  const slot = W / data.length;
  const barWidth = Math.min(slot - 10, 52);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      className={className}
      footer={
        <details className="group">
          <summary className="cursor-pointer list-none text-[12px] text-fg/62 transition-colors hover:text-fg/86">
            <span className="group-open:hidden">▸ View as table</span>
            <span className="hidden group-open:inline">▾ Hide table</span>
          </summary>
          <table className="mt-2 w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-fg/62">
                <th scope="col" className="py-1 font-medium">Category</th>
                <th scope="col" className="py-1 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-t border-fg/12">
                  <td className="py-1 text-fg/86">{d.label}</td>
                  <td className="py-1 text-right tabular-nums text-fg/86">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      }
    >
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${d.value}`).join(', ')}.`}>
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1="0"
              x2={W}
              y1={padTop + plot * t}
              y2={padTop + plot * t}
              stroke={GRID}
              strokeWidth="1"
            />
          ))}

          {data.map((datum, index) => {
            const height = (datum.value / max) * plot;
            const x = index * slot + (slot - barWidth) / 2;
            const y = padTop + plot - height;
            const active = hover === index;

            return (
              <g
                key={datum.label}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${datum.label}: ${datum.value} ${valueLabel}`}
                className="cursor-default outline-none"
              >
                {/* Hit target taller than the mark. */}
                <rect x={index * slot} y={padTop} width={slot} height={plot} fill="transparent" />

                <motion.path
                  initial={{ opacity: 0 }}
                  animate={{ opacity: active ? 1 : 0.86 }}
                  transition={{ duration: DURATION.fast }}
                  d={barPath(x, y, barWidth, height, 4)}
                  fill={seriesColor(index)}
                />

                {/* Direct label — four or fewer series, so every bar gets one. */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={active ? INK.primary : INK.secondary}
                  className="tabular-nums transition-colors"
                >
                  {datum.value}
                </text>

                <text
                  x={x + barWidth / 2}
                  y={H - 9}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={active ? INK.secondary : INK.muted}
                >
                  {datum.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hover !== null && data[hover] && (
          <Tooltip x={((hover + 0.5) / data.length) * 100} y={((padTop + plot - (data[hover]!.value / max) * plot) / H) * 100}>
            <span className="font-semibold text-fg">{data[hover]!.label}</span>
            <span className="ml-2 tabular-nums text-fg/78">
              {data[hover]!.value} {valueLabel}
            </span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Donut — parts of one whole, using the reserved status palette
 * ------------------------------------------------------------------ */

export interface DonutSegment {
  label: string;
  value: number;
  tone: keyof typeof STATUS_COLORS;
  glyph: string;
}

export function DonutChart({
  title,
  subtitle,
  segments,
  centreLabel,
  className,
}: {
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
  centreLabel: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (!total) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">No fixtures for this filter.</p>
      </ChartFrame>
    );
  }

  const R = 15.915; // circumference = 100
  let offset = 25; // start at 12 o'clock

  return (
    <ChartFrame title={title} subtitle={subtitle} className={className}>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <svg width="118" height="118" viewBox="0 0 42 42" role="img" aria-label={`${title}. ${segments.map((s) => `${s.label}: ${s.value}`).join(', ')}.`}>
            <title id={gradientId}>{title}</title>
            <circle cx="21" cy="21" r={R} fill="none" stroke={GRID} strokeWidth="5" />

            {segments.map((segment, index) => {
              const share = (segment.value / total) * 100;
              /* 2px surface gap between adjacent fills — drawn as a dash gap. */
              const gap = share > 4 ? 1.2 : 0;
              const dash = Math.max(share - gap, 0.4);
              const element = (
                <motion.circle
                  key={segment.label}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={STATUS_COLORS[segment.tone]}
                  strokeWidth={hover === index ? 6.5 : 5}
                  strokeDasharray={`${dash} ${100 - dash}`}
                  strokeDashoffset={offset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: DURATION.base, delay: index * 0.1 }}
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: 'stroke-width .2s' }}
                />
              );
              offset -= share;
              return element;
            })}

            <text x="21" y="21.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={INK.primary} className="tabular-nums">
              {total}
            </text>
            <text x="21" y="26" textAnchor="middle" fontSize="2.8" fill={INK.muted} letterSpacing="0.18">
              {centreLabel.toUpperCase()}
            </text>
          </svg>
        </div>

        {/* Legend is always present for >= 2 series, and carries glyph + label so
            identity never depends on colour. */}
        <ul className="min-w-[140px] flex-1 space-y-2">
          {segments.map((segment, index) => (
            <li
              key={segment.label}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              className={clsx(
                'flex items-center gap-2.5 rounded px-1 py-0.5 text-[13px] transition-colors',
                hover === index ? 'bg-fg/7 text-fg' : 'text-fg/78',
              )}
            >
              <span
                aria-hidden="true"
                className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm text-[8px] font-bold text-ink-900"
                style={{ background: STATUS_COLORS[segment.tone] }}
              >
                {segment.glyph}
              </span>
              <span className="min-w-0 flex-1 truncate">{segment.label}</span>
              <span className="tabular-nums font-semibold text-fg/90">{segment.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Line — change over time, one series
 * ------------------------------------------------------------------ */

export function LineChart({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  /* Every hook must run on every render — this one sits above the early return
     so the hook order cannot change when the series empties out. */
  const fillId = useId();

  if (data.length < 2) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">Not enough history yet.</p>
      </ChartFrame>
    );
  }

  const W = 400;
  const H = 150;
  const padX = 10;
  const padY = 18;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const span = max - min || 1;

  const pointAt = (index: number, value: number) => ({
    x: padX + (index / (data.length - 1)) * (W - padX * 2),
    y: padY + (1 - (value - min) / span) * (H - padY * 2),
  });

  const points = data.map((d, i) => pointAt(i, d.value));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1]!.x},${H - padY} L${points[0]!.x},${H - padY} Z`;

  return (
    <ChartFrame title={title} subtitle={subtitle} className={className}>
      <div
        className="relative"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, index)));
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${d.value}`).join(', ')}.`}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CATEGORICAL[3]} stopOpacity="0.28" />
              <stop offset="100%" stopColor={CATEGORICAL[3]} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((t) => (
            <line key={t} x1="0" x2={W} y1={padY + t * (H - padY * 2)} y2={padY + t * (H - padY * 2)} stroke={GRID} strokeWidth="1" />
          ))}

          <path d={area} fill={`url(#${fillId})`} />

          <motion.path
            d={line}
            fill="none"
            stroke={CATEGORICAL[3]}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: EASE.luxe }}
          />

          {hover !== null && points[hover] && (
            <>
              <line x1={points[hover]!.x} x2={points[hover]!.x} y1={padY} y2={H - padY} stroke="rgb(var(--fg-rgb) / 0.22)" strokeWidth="1" />
              {/* >= 8px marker, with a 2px surface ring so it reads over the line. */}
              <circle cx={points[hover]!.x} cy={points[hover]!.y} r="5" fill={CATEGORICAL[3]} stroke="rgb(var(--surface-rgb))" strokeWidth="2" />
            </>
          )}
        </svg>

        <div className="mt-1.5 flex justify-between px-1 text-[11.5px] text-fg/58">
          {data.map((d, i) => (
            <span key={d.label} className={clsx(hover === i && 'text-fg/86')}>
              {d.label}
            </span>
          ))}
        </div>

        {hover !== null && data[hover] && points[hover] && (
          <Tooltip x={(points[hover]!.x / W) * 100} y={(points[hover]!.y / H) * 100}>
            <span className="font-semibold text-fg">{data[hover]!.label}</span>
            <span className="ml-2 tabular-nums text-fg/78">{data[hover]!.value} registered</span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Fill meter — allocated vs capacity, per team
 * ------------------------------------------------------------------ */

export function FillMeters({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle?: string;
  data: { label: string; allocated: number; capacity: number }[];
  className?: string;
}) {
  if (!data.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">No teams configured yet.</p>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame title={title} subtitle={subtitle} className={className}>
      <ul className="space-y-2.5">
        {data.map((team) => {
          const ratio = team.capacity > 0 ? team.allocated / team.capacity : 0;
          const short = team.allocated < team.capacity;
          /* Status, not category: below capacity is a warning state and says so
             in words as well as colour. */
          const color = short ? STATUS_COLORS.warning : STATUS_COLORS.good;

          return (
            <li key={team.label} className="flex items-center gap-3">
              <span className="w-12 shrink-0 font-mono text-[12px] text-fg/72">{team.label}</span>

              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(ratio, 1) * 100}%` }}
                  transition={{ duration: DURATION.slow, ease: EASE.luxe }}
                  className="h-full rounded-full"
                  style={{ background: color }}
                />
              </div>

              <span className="w-20 shrink-0 text-right tabular-nums text-[12.5px] text-fg/78">
                {team.allocated}/{team.capacity}
                <span className="sr-only">{short ? ' — below capacity' : ' — full'}</span>
              </span>

              <span aria-hidden="true" className="w-3 shrink-0 text-[12px]" style={{ color }}>
                {short ? '◐' : '●'}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[12px] text-fg/58">
        <span aria-hidden="true" style={{ color: STATUS_COLORS.warning }}>
          ◐
        </span>{' '}
        below capacity ·{' '}
        <span aria-hidden="true" style={{ color: STATUS_COLORS.good }}>
          ●
        </span>{' '}
        full roster
      </p>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Stacked bar — composition within each category
 * ------------------------------------------------------------------ */

export interface StackedBand {
  label: string;
  parts: { label: string; value: number }[];
}

/**
 * Composition, not magnitude.
 *
 * Bands are stacked because the question is "what is this sub-group made of",
 * and four side-by-side bars per category would make the reader do the
 * addition themselves. The part order is taken from the first band so a type
 * keeps its colour across every category — the whole point of the comparison.
 */
export function StackedBarChart({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle?: string;
  data: StackedBand[];
  className?: string;
}) {
  const [hover, setHover] = useState<{ band: number; part: number } | null>(null);

  if (!data.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">No data for this filter.</p>
      </ChartFrame>
    );
  }

  /**
   * Colour is scoped to the band, not global.
   *
   * A flat legend keyed on part name looked right and was wrong here: the
   * categories do not share a vocabulary — Cricket has batsmen, Football has
   * goalkeepers — so a global index ran past the four validated steps and gave
   * Batsman and Goalkeeper the same magenta in one legend. Colouring by
   * position within the band keeps every stack internally distinct, and the
   * legend is printed per band so a repeated hue is unambiguous.
   *
   * "Unclassified" is a state, not a category, so it is always the same grey
   * and never consumes a categorical step.
   */
  const colorOf = (label: string, partIndex: number) =>
    label === 'Unclassified' ? 'rgb(var(--fg-rgb) / 0.22)' : seriesColor(partIndex);

  const totals = data.map((band) => band.parts.reduce((sum, p) => sum + p.value, 0));
  const max = Math.max(...totals, 1);

  const W = 400;
  const H = 190;
  const padTop = 16;
  const padBottom = 30;
  const plot = H - padTop - padBottom;
  const slot = W / data.length;
  const barWidth = Math.min(slot - 16, 64);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      className={className}
      footer={
        <ul className="space-y-1.5 text-[12px] text-fg/72">
          {data.map((band) => (
            <li key={band.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="shrink-0 font-semibold text-fg/82">{band.label}</span>
              {band.parts
                .filter((part) => part.value > 0)
                .map((part) => (
                  <span key={part.label} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: colorOf(part.label, band.parts.indexOf(part)) }}
                    />
                    {part.label}
                  </span>
                ))}
            </li>
          ))}
        </ul>
      }
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${title}. ${data
            .map((b) => `${b.label}: ${b.parts.map((p) => `${p.value} ${p.label}`).join(', ')}`)
            .join('. ')}.`}
        >
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1="0"
              x2={W}
              y1={padTop + plot * t}
              y2={padTop + plot * t}
              stroke={GRID}
              strokeWidth="1"
            />
          ))}

          {data.map((band, bandIndex) => {
            const x = bandIndex * slot + (slot - barWidth) / 2;
            let cursor = padTop + plot;

            return (
              <g key={band.label}>
                {band.parts.map((part, partIndex) => {
                  if (part.value <= 0) return null;
                  const height = (part.value / max) * plot;
                  cursor -= height;
                  const active = hover?.band === bandIndex && hover.part === partIndex;
                  /* Only the topmost band is rounded — the rest butt together. */
                  const isTop = band.parts.slice(partIndex + 1).every((p) => p.value <= 0);

                  return (
                    <motion.path
                      key={part.label}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: active ? 1 : 0.88 }}
                      transition={{ duration: DURATION.fast }}
                      d={
                        isTop
                          ? barPath(x, cursor, barWidth, height, 4)
                          : `M${x},${cursor} h${barWidth} v${height} h${-barWidth} Z`
                      }
                      fill={colorOf(part.label, partIndex)}
                      stroke="rgb(var(--surface-rgb))"
                      strokeWidth="1"
                      tabIndex={0}
                      role="graphics-symbol"
                      aria-label={`${band.label}, ${part.label}: ${part.value}`}
                      className="cursor-default outline-none"
                      onMouseEnter={() => setHover({ band: bandIndex, part: partIndex })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ band: bandIndex, part: partIndex })}
                      onBlur={() => setHover(null)}
                    />
                  );
                })}

                <text
                  x={x + barWidth / 2}
                  y={padTop + plot - (totals[bandIndex]! / max) * plot - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={INK.secondary}
                  className="tabular-nums"
                >
                  {totals[bandIndex]}
                </text>

                <text
                  x={x + barWidth / 2}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={INK.muted}
                >
                  {band.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hover && data[hover.band]?.parts[hover.part] && (
          <Tooltip x={((hover.band + 0.5) / data.length) * 100} y={20}>
            <span className="font-semibold text-fg">{data[hover.band]!.label}</span>
            <span className="ml-2 text-fg/78">
              {data[hover.band]!.parts[hover.part]!.label}:{' '}
              <span className="tabular-nums">{data[hover.band]!.parts[hover.part]!.value}</span>
            </span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Ranked horizontal bars — a leaderboard
 * ------------------------------------------------------------------ */

/**
 * Horizontal because the labels are people's names.
 *
 * Rotated or truncated names on a vertical axis are the usual failure here,
 * and a name that cannot be read is not a data point.
 */
export function RankedBars({
  title,
  subtitle,
  data,
  valueLabel = 'awards',
  className,
  emptyMessage = 'Nothing to rank yet.',
}: {
  title: string;
  subtitle?: string;
  data: { label: string; value: number; caption?: string }[];
  valueLabel?: string;
  className?: string;
  emptyMessage?: string;
}) {
  if (!data.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">{emptyMessage}</p>
      </ChartFrame>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ChartFrame title={title} subtitle={subtitle} className={className}>
      <ol className="space-y-2">
        {data.map((datum, index) => (
          <li key={datum.label} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-right font-mono text-[11.5px] text-fg/45 tabular-nums">
              {index + 1}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] text-fg/90" title={datum.label}>
                  {datum.label}
                  {datum.caption && (
                    <span className="ml-1.5 text-[11.5px] text-fg/52">{datum.caption}</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-[12.5px] font-semibold text-fg/82">
                  {datum.value}
                  <span className="sr-only"> {valueLabel}</span>
                </span>
              </span>

              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fg/8">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${(datum.value / max) * 100}%` }}
                  transition={{ duration: DURATION.slow, ease: EASE.luxe, delay: index * 0.03 }}
                  className="block h-full rounded-full"
                  style={{ background: seriesColor(index) }}
                />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Funnel — drop-off through a sequence of strict subsets
 * ------------------------------------------------------------------ */

/**
 * Only legitimate when every step really is a subset of the one above it.
 * Here it is: a participant cannot be typed without a sub-group, or squadded
 * without a type. The number that matters is the gap between adjacent bars,
 * so each step states its own drop explicitly rather than leaving it to be
 * eyeballed off the widths.
 */
export function FunnelChart({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle?: string;
  data: { label: string; value: number; hint: string }[];
  className?: string;
}) {
  if (!data.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">Nothing on the register yet.</p>
      </ChartFrame>
    );
  }

  const top = Math.max(data[0]!.value, 1);

  return (
    <ChartFrame title={title} subtitle={subtitle} className={className}>
      <ol className="space-y-2">
        {data.map((step, index) => {
          const previous = index > 0 ? data[index - 1]!.value : null;
          const dropped = previous === null ? 0 : previous - step.value;
          const share = Math.round((step.value / top) * 100);

          return (
            <li key={step.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] text-fg/90">
                  {step.label}
                  <span className="ml-1.5 text-[11.5px] text-fg/52">{step.hint}</span>
                </span>
                <span className="shrink-0 tabular-nums text-[12.5px] font-semibold text-fg/86">
                  {step.value}
                  <span className="ml-1.5 font-normal text-fg/52">{share}%</span>
                </span>
              </div>

              <div className="mt-1 h-3 overflow-hidden rounded bg-fg/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ duration: DURATION.slow, ease: EASE.luxe, delay: index * 0.06 }}
                  className="h-full rounded"
                  style={{ background: seriesColor(index) }}
                />
              </div>

              {dropped > 0 && (
                <p className="mt-1 text-[11.5px] text-fg/52">
                  <span aria-hidden="true" className="mr-1">
                    ↳
                  </span>
                  {dropped} did not reach this step
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Dual line — two series that have to be read against each other
 * ------------------------------------------------------------------ */

export function DualLineChart({
  title,
  subtitle,
  data,
  seriesA,
  seriesB,
  className,
}: {
  title: string;
  subtitle?: string;
  data: { label: string; a: number; b: number }[];
  seriesA: string;
  seriesB: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <ChartFrame title={title} subtitle={subtitle} className={className}>
        <p className="py-10 text-center text-[13.5px] text-fg/58">Not enough history yet.</p>
      </ChartFrame>
    );
  }

  const W = 400;
  const H = 150;
  const padX = 10;
  const padY = 18;
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);

  const path = (key: 'a' | 'b') =>
    data
      .map((d, i) => {
        const x = padX + (i / (data.length - 1)) * (W - padX * 2);
        const y = padY + (1 - d[key] / max) * (H - padY * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const xAt = (i: number) => padX + (i / (data.length - 1)) * (W - padX * 2);
  const yAt = (v: number) => padY + (1 - v / max) * (H - padY * 2);

  /* The second series is dashed as well as differently coloured, so the two
     stay separable in greyscale and for a viewer with a colour deficiency. */
  const SERIES = [
    { key: 'a' as const, name: seriesA, color: CATEGORICAL[3], dash: undefined },
    { key: 'b' as const, name: seriesB, color: CATEGORICAL[1], dash: '5 4' },
  ];

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      className={className}
      footer={
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg/72">
          {SERIES.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden="true" className="shrink-0">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeDasharray={s.dash}
                />
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      }
    >
      <div
        className="relative"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, index)));
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${title}. ${data
            .map((d) => `${d.label}: ${d.a} ${seriesA}, ${d.b} ${seriesB}`)
            .join('. ')}.`}
        >
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1="0"
              x2={W}
              y1={padY + t * (H - padY * 2)}
              y2={padY + t * (H - padY * 2)}
              stroke={GRID}
              strokeWidth="1"
            />
          ))}

          {SERIES.map((s, i) => (
            <motion.path
              key={s.key}
              d={path(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeDasharray={s.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: EASE.luxe, delay: i * 0.12 }}
            />
          ))}

          {hover !== null && data[hover] && (
            <>
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={padY}
                y2={H - padY}
                stroke="rgb(var(--fg-rgb) / 0.22)"
                strokeWidth="1"
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={xAt(hover)}
                  cy={yAt(data[hover]![s.key])}
                  r="5"
                  fill={s.color}
                  stroke="rgb(var(--surface-rgb))"
                  strokeWidth="2"
                />
              ))}
            </>
          )}
        </svg>

        <div className="mt-1.5 flex justify-between px-1 text-[11.5px] text-fg/58">
          {data.map((d, i) => (
            <span key={d.label} className={clsx(hover === i && 'text-fg/86')}>
              {d.label}
            </span>
          ))}
        </div>

        {hover !== null && data[hover] && (
          <Tooltip x={(xAt(hover) / W) * 100} y={(yAt(Math.max(data[hover]!.a, data[hover]!.b)) / H) * 100}>
            <span className="font-semibold text-fg">{data[hover]!.label}</span>
            <span className="ml-2 tabular-nums text-fg/78">
              {data[hover]!.a} {seriesA} · {data[hover]!.b} {seriesB}
            </span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}
