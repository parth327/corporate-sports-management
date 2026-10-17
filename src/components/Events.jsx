import { forwardRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ACCENTS, CATEGORIES, EVENTS } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import SectionHeading from './ui/SectionHeading.jsx';

/**
 * Card art. Events with a photograph get the photograph; Cultural and anything
 * else without one gets a generated gradient field instead of a borrowed sports
 * image, because a cultural festival illustrated with a cricket pitch reads as
 * a placeholder and undermines the whole section.
 */
function CardArt({ event, accent }) {
  if (event.image) {
    return (
      <>
        <img
          src={event.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/55 to-ink-900/10" />
      </>
    );
  }

  return (
    <>
      <span className={`absolute inset-0 ${accent.bg} opacity-25`} />
      <span className="absolute inset-0 bg-gradient-to-br from-magenta-600/60 via-ink-900/20 to-azure-600/40" />
      <span className="absolute inset-0 bg-grid-fade bg-grid opacity-40" />
      <span
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-magenta-400/40 blur-3xl transition-all duration-700 group-hover:h-56 group-hover:w-56"
        aria-hidden="true"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/45 to-transparent" />
    </>
  );
}

/**
 * Ref is forwarded because `AnimatePresence mode="popLayout"` measures the
 * outgoing node before it animates out — without a forwarded ref framer cannot
 * reach the DOM element and the exit animation silently degrades.
 */
const EventCard = forwardRef(function EventCard({ event, index }, ref) {
  const accent = ACCENTS[event.accent];

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.slow, ease: EASE.luxe, delay: (index % 3) * 0.08 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-fg/10 bg-surface-raised/60 backdrop-blur-xl transition-colors duration-500 hover:border-fg/25"
    >
      {/* Art */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <CardArt event={event} accent={accent} />

        <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-ink-900/70 px-3 py-1 font-mono text-[10px] uppercase tracking-hud text-white/70 backdrop-blur-md">
          {event.kicker}
        </span>
        <span
          className={`absolute right-4 top-4 font-display text-4xl leading-none ${accent.text} opacity-70`}
          aria-hidden="true"
        >
          {event.code}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-2xl uppercase leading-tight tracking-tight text-fg sm:text-[27px]">
          {event.name}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className={`font-mono text-[10px] uppercase tracking-hud ${accent.panel}`}>
            {event.window}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-hud text-fg/70">
            {event.venue}
          </span>
        </div>

        <p className="mt-4 flex-1 text-sm leading-relaxed text-fg/76">{event.summary}</p>

        {/* Vitals strip */}
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-fg/10 bg-fg/[0.07]">
          <div className="bg-surface/70 px-4 py-3">
            <span className="block font-cond text-lg leading-none text-fg">{event.teams}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-hud text-fg/70">
              Teams
            </span>
          </div>
          <div className="bg-surface/70 px-4 py-3">
            <span className="block font-cond text-lg leading-none text-fg">
              {event.participants.toLocaleString('en-IN')}
            </span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-hud text-fg/70">
              Participants
            </span>
          </div>
        </div>

        <a
          href="#register"
          className="mt-5 inline-flex items-center gap-2 font-cond text-sm uppercase tracking-wider2 text-fg/70 coarse:-mb-3 coarse:mt-2 coarse:py-3 transition-colors hover:text-accent-solar"
        >
          Enter this event
          <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
            →
          </span>
        </a>
      </div>

      {/* Bottom accent rule, drawn in on hover */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 ${accent.bg} transition-transform duration-500 group-hover:scale-x-100`}
      />
    </motion.article>
  );
});

export default function Events() {
  const [filter, setFilter] = useState('all');
  const visible = filter === 'all' ? EVENTS : EVENTS.filter((e) => e.category === filter);

  return (
    <section id="events" className="relative py-24 sm:py-32">
      <div className="shell">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="The season at a glance"
            title="FOURTEEN EVENTS, ONE CALENDAR"
            body="Every vertical the company runs, from the floodlit cricket league to Safety Week on the shop floor. Filter by the kind of event you are looking for."
            accentClass="text-solar-400"
          />

          {/* Category filter */}
          <div className="flex flex-wrap gap-2 lg:shrink-0">
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
                      layoutId="event-filter-pill"
                      className="absolute inset-0 rounded-full bg-solar-500"
                      transition={{ duration: DURATION.base, ease: EASE.luxe }}
                    />
                  )}
                  <span className="relative">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <motion.div layout className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
