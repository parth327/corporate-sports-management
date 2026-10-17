import { motion } from 'framer-motion';
import { ACCENTS, PILLARS, PILLARS_COPY } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import SectionHeading from './ui/SectionHeading.jsx';
import Reveal from './ui/Reveal.jsx';

export default function Pillars() {
  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="shell">
        <SectionHeading
          eyebrow={PILLARS_COPY.eyebrow}
          title={PILLARS_COPY.title}
          body={PILLARS_COPY.body}
          accentClass="text-azure-400"
        />

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
          className="mt-14 grid gap-5 md:grid-cols-3"
        >
          {PILLARS.map((pillar) => {
            const accent = ACCENTS[pillar.accent];
            return (
              <motion.article
                key={pillar.title}
                variants={{
                  hidden: { opacity: 0, y: 32 },
                  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.luxe } },
                }}
                whileHover={{ y: -6 }}
                transition={{ duration: DURATION.fast, ease: EASE.luxe }}
                className="glass group relative overflow-hidden rounded-2xl p-7"
              >
                {/* Accent wash that blooms on hover */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full ${accent.bg} opacity-[0.07] blur-3xl transition-opacity duration-500 group-hover:opacity-20`}
                />

                <span className={`hud-label ${accent.panel}`}>{pillar.code}</span>
                <h3 className="mt-4 font-display text-3xl uppercase tracking-tight text-fg">
                  {pillar.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-fg/78">{pillar.body}</p>

                <span
                  aria-hidden="true"
                  className={`mt-7 block h-px w-full origin-left scale-x-0 ${accent.bg} opacity-60 transition-transform duration-500 group-hover:scale-x-100`}
                />
              </motion.article>
            );
          })}
        </motion.div>

        {/* Pull-quote band */}
        <Reveal delay={0.1} className="mt-16">
          <blockquote className="glass-strong relative overflow-hidden rounded-2xl px-7 py-10 sm:px-12 sm:py-14">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-grid-fade bg-grid opacity-[0.35]"
            />
            <p className="relative font-display text-[clamp(1.5rem,4vw,2.75rem)] uppercase leading-[1.05] tracking-tightest text-fg/90">
              “A season gives four thousand people a{' '}
              <span className="text-accent-solar">shared calendar</span> — and a reason to learn each
              other’s names.”
            </p>
            <footer className="relative mt-6 font-mono text-[10px] uppercase tracking-hud text-fg/72">
              Employee Engagement Council · Apex Corporate Enterprises
            </footer>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}
