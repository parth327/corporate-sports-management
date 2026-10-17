import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ACCENTS, EVENTS, SPOTLIGHT_IDS, eventById } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import SectionHeading from './ui/SectionHeading.jsx';
import { useSectionAccent } from '../lib/hooks.js';

const FLAGSHIPS = SPOTLIGHT_IDS.map(eventById).filter(Boolean);

/**
 * Deep-dive on the three flagship events.
 *
 * The tab underline uses a shared `layoutId`, so framer animates one element
 * between positions instead of cross-fading three — the indicator physically
 * slides to the tab you picked, which is what makes the control feel connected
 * to the content rather than decorative.
 */
export default function Spotlight() {
  const [activeId, setActiveId] = useState(FLAGSHIPS[0]?.id ?? EVENTS[0].id);
  const active = eventById(activeId) ?? EVENTS[0];
  const accent = ACCENTS[active.accent];
  const accentRef = useSectionAccent(accent.hex);
  const tabRefs = useRef([]);

  /* WAI-ARIA tabs: arrows move between tabs (and select, since panels are cheap), Home/End jump to the ends. */
  const onTabKeyDown = (event, index) => {
    const last = FLAGSHIPS.length - 1;
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActiveId(FLAGSHIPS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section ref={accentRef} id="spotlight" className="relative py-24 sm:py-32">
      <div className="shell">
        <SectionHeading
          eyebrow="Flagship events"
          title="THE THREE THAT DEFINE THE SEASON"
          body="Cricket fills the calendar, football fills the evenings, and Cultural fills the auditorium. Everything else orbits these three."
          accentClass={accent.text}
        />

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Flagship events"
          className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-b border-white/15"
        >
          {FLAGSHIPS.map((event, index) => {
            const isActive = event.id === activeId;
            return (
              <button
                key={event.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                id={`spotlight-tab-${event.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="spotlight-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveId(event.id)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
                className={`relative -mb-px pb-4 font-display text-xl uppercase tracking-tight transition-colors duration-300 sm:text-2xl ${
                  isActive ? 'text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                {event.name}
                {isActive && (
                  <motion.span
                    layoutId="spotlight-underline"
                    className={`absolute inset-x-0 bottom-0 h-[2px] ${ACCENTS[event.accent].bg}`}
                    transition={{ duration: DURATION.base, ease: EASE.luxe }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            id="spotlight-panel"
            role="tabpanel"
            aria-labelledby={`spotlight-tab-${active.id}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: DURATION.base, ease: EASE.luxe }}
            className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1fr]"
          >
            {/* Visual side */}
            <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-fg/10 lg:min-h-[520px]">
              {active.image ? (
                <img
                  src={active.image}
                  alt={`${active.name} — ${active.venue}`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 bg-gradient-to-br from-magenta-600 via-ink-800 to-azure-700" />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/35 to-transparent" />
              <span className="absolute inset-0 bg-grid-fade bg-grid opacity-25" />

              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <span className={`hud-label ${accent.text}`}>{active.kicker}</span>
                <p className="mt-3 font-display text-[clamp(1.9rem,5vw,3.25rem)] uppercase leading-[0.95] tracking-tightest text-white">
                  {active.name}
                </p>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">{active.summary}</p>
              </div>
            </div>

            {/* Detail side */}
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-fg/10 bg-fg/[0.07]">
                {[
                  { k: 'Window', v: active.window },
                  { k: 'Venue', v: active.venue },
                  { k: 'Format', v: active.format },
                  { k: 'Participants', v: `${active.participants.toLocaleString('en-IN')} entrants` },
                ].map((row) => (
                  <div key={row.k} className="bg-surface-raised/70 px-5 py-5 backdrop-blur-xl">
                    <span className="hud-label">{row.k}</span>
                    <p className="mt-2 font-cond text-base leading-snug text-fg sm:text-lg">{row.v}</p>
                  </div>
                ))}
              </div>

              <motion.ul
                initial="hidden"
                whileInView="show"
                viewport={VIEWPORT}
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
                className="glass flex-1 space-y-0 overflow-hidden rounded-2xl"
              >
                {active.highlights.map((line, i) => (
                  <motion.li
                    key={i}
                    variants={{
                      hidden: { opacity: 0, x: -12 },
                      show: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE.luxe } },
                    }}
                    className="flex gap-4 border-b border-fg/[0.07] px-6 py-5 last:border-b-0"
                  >
                    <span className={`mt-1 font-mono text-[10px] tracking-hud ${accent.panel}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm leading-relaxed text-fg/78">{line}</span>
                  </motion.li>
                ))}
              </motion.ul>

              <a href="#register" className="btn-primary self-start">
                Enter {active.name}
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
