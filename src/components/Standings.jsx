import { motion } from 'framer-motion';
import { ACCENTS, COMPANY, STANDINGS, STANDINGS_COPY } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import SectionHeading from './ui/SectionHeading.jsx';
import Counter from './ui/Counter.jsx';
import { useSectionAccent } from '../lib/hooks.js';

const TREND = {
  up: { glyph: '▲', className: 'text-accent-phthalo' },
  down: { glyph: '▼', className: 'text-rose-400' },
  flat: { glyph: '—', className: 'text-fg/68' },
};

/** Podium tone: gold, silver, bronze, then neutral (large type, so /55 still clears 3:1 in both themes). */
const rankTone = (rank) => {
  if (rank === 1) return 'text-accent-solar';
  if (rank === 2) return 'text-fg/90';
  if (rank === 3) return 'text-[#cd7f32] [[data-theme=light]_&]:text-[#8a5523]';
  return 'text-fg/55';
};

/**
 * One division's row.
 *
 * The points bar is drawn in that division's own colour rather
 * than a single league colour — with eight squads each carrying a distinct colour,
 * the table itself becomes a swatch card. Colour is applied
 * inline because these values come from data, not from the Tailwind palette.
 */
function Row({ row, leaderPoints, index }) {
  const trend = TREND[row.trend] ?? TREND.flat;
  const share = row.points / leaderPoints;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.base, ease: EASE.luxe, delay: index * 0.06 }}
      className="group relative grid grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-fg/[0.07] px-2 py-5 transition-colors duration-300 hover:bg-fg/[0.02] sm:grid-cols-[52px_1fr_repeat(3,60px)] sm:gap-5"
    >
      <span className={`font-display text-2xl leading-none sm:text-3xl ${rankTone(row.rank)}`}>
        {String(row.rank).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="truncate font-cond text-base text-fg sm:text-lg">{row.division}</span>

          {/* Colour identity chip: swatch, colour name, colour code. */}
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-fg/25"
              style={{ backgroundColor: row.hex }}
              aria-hidden="true"
            />
            <span className="font-mono text-[10px] uppercase tracking-hud text-fg/74">
              {row.shade}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-hud text-fg/65">
              {row.code}
            </span>
          </span>
        </div>

        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.07]">
          <motion.span
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: share }}
            viewport={VIEWPORT}
            transition={{ duration: DURATION.epic, ease: EASE.luxe, delay: 0.15 + index * 0.06 }}
            className="block h-full origin-left rounded-full"
            style={{
              backgroundColor: row.hex,
              boxShadow: `0 0 18px -2px ${row.hex}`,
            }}
          />
        </div>

        {/* Compact stats — mobile only; desktop shows these as columns. */}
        <div className="mt-2 flex gap-4 sm:hidden">
          <span className="font-mono text-[10px] uppercase tracking-hud text-fg/70">
            P {row.played}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-hud text-fg/70">
            W {row.won}
          </span>
          <span className={`font-mono text-[10px] ${trend.className}`}>{trend.glyph}</span>
        </div>
      </div>

      <span className="hidden text-center font-cond text-lg tabular-nums text-fg/76 sm:block">
        {row.played}
      </span>
      <span className="hidden text-center font-cond text-lg tabular-nums text-fg/76 sm:block">
        {row.won}
      </span>

      <div className="flex items-center justify-end gap-2 sm:justify-center">
        <Counter
          value={row.points}
          className={`font-display text-2xl tabular-nums sm:text-[26px] ${
            row.rank === 1 ? 'text-accent-solar' : 'text-fg'
          }`}
        />
        <span className={`hidden font-mono text-[10px] sm:inline ${trend.className}`}>
          {trend.glyph}
        </span>
      </div>
    </motion.div>
  );
}

export default function Standings() {
  const leader = STANDINGS[0];
  const accentRef = useSectionAccent(ACCENTS.solar.hex);

  return (
    <section ref={accentRef} id="standings" className="relative py-24 sm:py-32">
      <div className="shell">
        <SectionHeading
          eyebrow={STANDINGS_COPY.eyebrow}
          title={STANDINGS_COPY.title}
          body={STANDINGS_COPY.body}
          accentClass="text-solar-400"
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_330px]">
          <div className="glass-strong overflow-hidden rounded-2xl p-4 sm:p-6">
            <div className="hidden grid-cols-[52px_1fr_repeat(3,60px)] gap-5 border-b border-fg/10 px-2 pb-3 sm:grid">
              <span className="hud-label">#</span>
              <span className="hud-label">Division &amp; colour</span>
              <span className="hud-label text-center">P</span>
              <span className="hud-label text-center">W</span>
              <span className="hud-label text-center">Pts</span>
            </div>

            {STANDINGS.map((row, i) => (
              <Row key={row.code} row={row} leaderPoints={leader.points} index={i} />
            ))}

            <p className="px-2 pt-5 text-xs leading-relaxed text-fg/70">{STANDINGS_COPY.note}</p>
          </div>

          {/* Leader card */}
          <motion.aside
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: DURATION.slow, ease: EASE.luxe, delay: 0.15 }}
            className="relative overflow-hidden rounded-2xl border border-solar-500/30 bg-surface-raised/70 backdrop-blur-xl"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src="/images/trophy-lights.jpg"
                alt="The Spectrum Trophy under arena lights"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-ink-800 via-ink-900/40 to-transparent" />
              <span className="absolute left-4 top-4 rounded-full border border-fg/20 bg-surface/70 px-3 py-1 font-mono text-[10px] uppercase tracking-hud text-fg/75 backdrop-blur-md">
                The Spectrum Trophy
              </span>
            </div>

            <div className="p-6">
              <span className="hud-label !text-accent-solar">Current leader</span>

              <p className="mt-3 font-display text-2xl uppercase leading-tight tracking-tight text-fg">
                {leader.division}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 rounded-sm ring-1 ring-fg/25"
                  style={{ backgroundColor: leader.hex }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[11px] uppercase tracking-hud text-fg/78">
                  {leader.shade} · {leader.code}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-fg/76">
                Three consecutive seasons at the top of the table, built on turnout as much as
                results — {leader.won} wins from {leader.played} contested events.
              </p>

              <div className="mt-6 flex items-end gap-2">
                <Counter
                  value={leader.points}
                  className="font-display text-5xl leading-none text-accent-solar glow-solar"
                />
                <span className="pb-1 font-mono text-[10px] uppercase tracking-hud text-fg/72">
                  points
                </span>
              </div>

              <p className="mt-5 border-t border-fg/10 pt-4 font-cond text-xs uppercase tracking-wider2 text-fg/70">
                {COMPANY.league} · {COMPANY.season}
              </p>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}
