import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ACCENTS, CATEGORIES, SCHEDULE, eventById, scheduleByMonth } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import SectionHeading from './ui/SectionHeading.jsx';

const CATEGORY_ACCENT = {
  sports: 'solar',
  cultural: 'magenta',
  wellness: 'phthalo',
  corporate: 'azure',
};

function Row({ row, index }) {
  const event = eventById(row.eventId);
  const accent = ACCENTS[CATEGORY_ACCENT[row.category] ?? 'azure'];
  const [day, month] = row.display.split(' ');

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.base, ease: EASE.luxe, delay: Math.min(index * 0.04, 0.3) }}
      className="group relative"
    >
      <a
        href="#register"
        className="flex flex-col gap-4 border-b border-white/[0.08] py-6 transition-colors duration-300 hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-7 sm:px-2"
      >
        {/* Date block */}
        <div className="flex shrink-0 items-baseline gap-2 sm:w-24 sm:flex-col sm:items-center sm:gap-0">
          <span className="font-display text-3xl leading-none text-white sm:text-4xl">{day}</span>
          <span className="font-mono text-[10px] uppercase tracking-hud text-white/72">{month}</span>
        </div>

        {/* Accent rail */}
        <span
          aria-hidden="true"
          className={`hidden h-12 w-px shrink-0 ${accent.bg} opacity-40 transition-opacity duration-300 group-hover:opacity-100 sm:block`}
        />

        {/* Detail */}
        <div className="min-w-0 flex-1">
          <p className="font-cond text-lg leading-snug text-white transition-colors duration-300 group-hover:text-solar-400 sm:text-xl">
            {row.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-[10px] uppercase tracking-hud text-white/70">
              {row.venue}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-hud text-white/70">
              {row.time}
            </span>
            {event && (
              <span className={`font-mono text-[10px] uppercase tracking-hud ${accent.text}`}>
                {event.name}
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex shrink-0 items-center gap-4">
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-hud text-white/76">
            {row.status}
          </span>
          <span
            aria-hidden="true"
            className="text-white/65 transition-all duration-300 group-hover:translate-x-1 group-hover:text-solar-400"
          >
            →
          </span>
        </div>
      </a>
    </motion.li>
  );
}

export default function Calendar() {
  const [filter, setFilter] = useState('all');
  const rows = filter === 'all' ? SCHEDULE : SCHEDULE.filter((r) => r.category === filter);
  const groups = scheduleByMonth(rows);

  return (
    <section id="calendar" className="relative py-24 sm:py-32">
      <div className="shell">
        <SectionHeading
          eyebrow="Season calendar"
          title="EVERY DATE THAT MATTERS"
          body="October through March, plant-wide. Add the ones you are entering to your own calendar — fixture-level timings publish two weeks before each event."
          accentClass="text-phthalo-400"
        />

        {/* Filters */}
        <div className="mt-10 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const active = filter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilter(cat.id)}
                aria-pressed={active}
                className={`relative rounded-full border px-4 py-2 font-cond text-sm uppercase tracking-wider2 transition-colors duration-300 ${
                  active
                    ? 'border-transparent text-ink-900'
                    : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="calendar-filter-pill"
                    className="absolute inset-0 rounded-full bg-phthalo-400"
                    transition={{ duration: DURATION.base, ease: EASE.luxe }}
                  />
                )}
                <span className="relative">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Grouped timeline */}
        <div className="mt-12 space-y-12">
          <AnimatePresence mode="popLayout">
            {groups.map((group) => (
              <motion.div
                layout
                key={group.month}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast }}
                className="grid gap-4 lg:grid-cols-[180px_1fr] lg:gap-10"
              >
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <h3 className="font-display text-xl uppercase tracking-tight text-white/85">
                    {group.month}
                  </h3>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-hud text-white/68">
                    {group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <ul className="border-t border-white/[0.08]">
                  {group.rows.map((row, i) => (
                    <Row key={row.id} row={row} index={i} />
                  ))}
                </ul>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {groups.length === 0 && (
          <p className="mt-12 font-cond text-lg text-white/72">
            No entries in this category yet — check back after the committee publishes fixtures.
          </p>
        )}
      </div>
    </section>
  );
}
