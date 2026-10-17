import { motion } from 'framer-motion';
import { ABOUT_COPY, ACCENTS, COMPANY, INDUSTRIES, INDUSTRIES_COPY, VALUES, VALUES_COPY, VISION_MISSION } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import { useSectionAccent } from '../lib/hooks.js';
import SectionHeading from './ui/SectionHeading.jsx';
import Reveal from './ui/Reveal.jsx';

/**
 * The company, in its own words.
 *
 * The company profile, values, vision and mission shown here are sample copy
 * for the demo — the values framework, the vision and mission statements, the
 * 2001 origin story, and the industries list. The sports reinterpretation of
 * A-C-E lives in Pillars, one section down; this one exists so that
 * reinterpretation is never mistaken for the source text itself.
 */
export default function AboutCompany() {
  const accentRef = useSectionAccent(ACCENTS.solar.hex);

  return (
    <section ref={accentRef} id="about-company" className="relative py-24 sm:py-32">
      <div className="shell">
        <SectionHeading
          eyebrow={ABOUT_COPY.eyebrow}
          title={ABOUT_COPY.title}
          body={ABOUT_COPY.intro}
          accentClass="text-solar-400"
        />

        {/* Origin + growth, as a two-column editorial block. */}
        <div className="mt-14 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Reveal className="glass-strong relative overflow-hidden rounded-2xl p-7 sm:p-10">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-magenta-500 opacity-[0.08] blur-3xl"
            />
            <p className="hud-label text-accent-magenta">2001 · Our story</p>
            <blockquote className="mt-4 font-display text-[clamp(1.2rem,2.6vw,1.9rem)] leading-[1.25] tracking-tight text-fg/92">
              “{ABOUT_COPY.origin}”
            </blockquote>

            <div className="mt-8 space-y-4 border-t border-fg/10 pt-6 text-[15px] leading-relaxed text-fg/76">
              <p>{ABOUT_COPY.growth}</p>
              <p>{ABOUT_COPY.transformation}</p>
              <p>{ABOUT_COPY.leadership}</p>
            </div>

            <p className="mt-6 font-mono text-[10px] uppercase tracking-hud text-fg/70">
              Founded by {COMPANY.founder} · Second generation, {COMPANY.secondGeneration}
            </p>
          </Reveal>

          {/* By the numbers + real contact, so the quotes sit beside facts a
              reader can verify rather than floating unattributed. */}
          <Reveal delay={0.1} className="flex flex-col gap-5">
            <div className="glass rounded-2xl p-6 sm:p-7">
              <p className="hud-label text-accent-azure">By the numbers</p>
              <dl className="mt-5 grid grid-cols-2 gap-5">
                {[
                  ['Years trading', '26+'],
                  ['Countries served', `${COMPANY.countries}+`],
                  ['Founded', COMPANY.founded],
                  ['Headquarters', COMPANY.city],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-fg/72">{k}</dt>
                    <dd className="mt-1 font-display text-2xl text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[13px] leading-relaxed text-fg/76">{ABOUT_COPY.reach}</p>
            </div>

            <div className="glass rounded-2xl p-6 sm:p-7">
              <p className="hud-label text-accent-phthalo">Reach the company</p>
              <ul className="mt-4 space-y-2.5 text-[14px] text-fg/70">
                <li>
                  <a href={`mailto:${COMPANY.email}`} className="text-accent-azure underline decoration-azure-300/40 underline-offset-4 hover:text-accent-azure">
                    {COMPANY.email}
                  </a>
                </li>
                {COMPANY.phone.map((p) => (
                  <li key={p}>
                    <a href={`tel:${p.replace(/[^\d+]/g, '')}`} className="font-mono text-fg/70 hover:text-fg">
                      {p}
                    </a>
                  </li>
                ))}
                <li className="pt-1 text-fg/76">{COMPANY.address}</li>
              </ul>
            </div>
          </Reveal>
        </div>

        {/* A-C-E values. */}
        <div className="mt-16">
          <SectionHeading eyebrow={VALUES_COPY.eyebrow} title={VALUES_COPY.title} body={VALUES_COPY.body} accentClass="text-solar-400" titleClass="text-[clamp(1.6rem,4vw,2.6rem)]" />

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
            className="mt-10 grid gap-5 md:grid-cols-3"
          >
            {VALUES.map((value, i) => {
              const accent = ACCENTS[value.accent];
              return (
                <motion.figure
                  key={`${value.letter}-${i}`}
                  variants={{
                    hidden: { opacity: 0, y: 26 },
                    show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.luxe } },
                  }}
                  className="glass relative overflow-hidden rounded-2xl p-7"
                >
                  <span className={`font-display text-6xl leading-none ${accent.panel}`}>{value.letter}</span>
                  <blockquote className="mt-5 text-[15px] leading-relaxed text-fg/80">“{value.quote}”</blockquote>
                  <figcaption className={`mt-5 h-px w-10 ${accent.bg} opacity-70`} />
                </motion.figure>
              );
            })}
          </motion.div>
        </div>

        {/* Vision & mission. */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Reveal className="glass-strong rounded-2xl p-7">
            <p className="hud-label text-accent-magenta">Vision</p>
            <p className="mt-3 text-[15.5px] leading-relaxed text-fg/85">{VISION_MISSION.vision}</p>
          </Reveal>
          <Reveal delay={0.08} className="glass-strong rounded-2xl p-7">
            <p className="hud-label text-accent-azure">Mission</p>
            <p className="mt-3 text-[15.5px] leading-relaxed text-fg/85">{VISION_MISSION.mission}</p>
          </Reveal>
        </div>

        {/* Industries served. */}
        <div className="mt-16">
          <SectionHeading eyebrow={INDUSTRIES_COPY.eyebrow} title={INDUSTRIES_COPY.title} body={INDUSTRIES_COPY.body} accentClass="text-phthalo-400" titleClass="text-[clamp(1.6rem,4vw,2.6rem)]" />

          <motion.ul
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.025 } } }}
            className="mt-9 flex flex-wrap gap-2.5"
          >
            {INDUSTRIES.map((industry, i) => {
              const accentKeys = Object.keys(ACCENTS);
              const accent = ACCENTS[accentKeys[i % accentKeys.length]];
              return (
                <motion.li
                  key={industry}
                  variants={{
                    hidden: { opacity: 0, scale: 0.9 },
                    show: { opacity: 1, scale: 1, transition: { duration: DURATION.fast, ease: EASE.luxe } },
                  }}
                  className={`rounded-full border ${accent.border} bg-surface-raised/40 px-4 py-2 text-[13px] text-fg/80 transition-colors hover:text-fg`}
                >
                  {industry}
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
