import { motion, useReducedMotion } from 'framer-motion';
import { ACCENTS, COMPANY, HERITAGE, HERITAGE_COPY } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import { useSectionAccent } from '../lib/hooks.js';
import SectionHeading from './ui/SectionHeading.jsx';

/**
 * The company timeline, 2001 to the current season.
 *
 * It earns its place on an events portal by answering the question the whole
 * season implicitly asks — why does any of this matter? Twenty-six years of
 * building together is the reason the league exists.
 *
 * On desktop the milestones scroll horizontally inside their own track; on
 * mobile they stack. The horizontal rail is a native overflow scroller rather
 * than a scroll-jacked pin, so it never fights the page scroll on a trackpad.
 */
export default function Heritage() {
  const reduced = useReducedMotion();
  const accentRef = useSectionAccent(ACCENTS.azure.hex);

  return (
    <section ref={accentRef} id="heritage" className="relative py-24 sm:py-32">
      <div className="shell">
        <SectionHeading
          eyebrow={HERITAGE_COPY.eyebrow}
          title={HERITAGE_COPY.title}
          body={HERITAGE_COPY.body}
          accentClass="text-azure-400"
        />
      </div>

      {/* Full-bleed rail so the track visibly runs off the edge of the page. Focusable, so a keyboard can scroll it too. */}
      <div
        role="region"
        aria-label="Company timeline, 2001 to today"
        tabIndex={0}
        className="mt-14 overflow-x-auto pb-4 [scrollbar-width:none] focus-visible:outline-offset-[-4px] [&::-webkit-scrollbar]:hidden"
      >
        <motion.ol
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="flex min-w-max gap-4 px-5 sm:px-8 lg:px-12"
        >
          {HERITAGE.map((item, i) => {
            const isLast = i === HERITAGE.length - 1;
            return (
              <motion.li
                key={item.year}
                variants={{
                  hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 30 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: DURATION.slow, ease: EASE.luxe },
                  },
                }}
                className={`group relative w-[248px] shrink-0 rounded-2xl border bg-surface-raised/55 p-6 backdrop-blur-xl transition-colors duration-500 sm:w-[286px] ${
                  isLast ? 'border-magenta-500/40' : 'border-fg/10 hover:border-fg/25'
                }`}
              >
                {/* Connector dot + rule running between cards. */}
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isLast ? 'bg-magenta-400' : 'bg-azure-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="h-px flex-1 bg-fg/10" aria-hidden="true" />
                </div>

                <p
                  className={`mt-5 font-display text-4xl leading-none ${
                    isLast ? 'text-accent-magenta' : 'text-fg'
                  }`}
                >
                  {item.year}
                </p>

                <h3 className="mt-3 font-cond text-base uppercase tracking-wider2 text-fg/85">
                  {item.title}
                </h3>

                <p className="mt-2.5 text-sm leading-relaxed text-fg/76">{item.body}</p>
              </motion.li>
            );
          })}
        </motion.ol>
      </div>

      <div className="shell">
        <p className="mt-6 font-mono text-[11px] uppercase tracking-hud text-white/70">
          {COMPANY.name} · {COMPANY.city} · {COMPANY.countries}+ countries served
        </p>
      </div>
    </section>
  );
}
