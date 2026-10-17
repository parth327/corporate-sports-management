import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { COMPANY, HERO, ACCENTS } from '../lib/site-data.js';
import { DURATION, EASE } from '../lib/motion.js';
import { useCountdown, useSectionAccent } from '../lib/hooks.js';
import Counter from './ui/Counter.jsx';
import MagneticButton from './ui/MagneticButton.jsx';

/** One unit of the countdown clock. */
function Unit({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-cond text-3xl font-semibold tabular-nums leading-none text-fg sm:text-4xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1.5 font-mono text-[10px] uppercase tracking-hud text-fg/68">{label}</span>
    </div>
  );
}

/** The ticking clock lives in its own component, so only these few nodes re-render every second. */
function NextFixture() {
  const { days, hours, minutes, seconds, live, fixture } = useCountdown();

  return (
    <div className="bg-surface-raised/75 p-6 backdrop-blur-xl sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="hud-label">{live ? 'Happening now' : 'Next on the calendar'}</span>
        <span className="font-mono text-[11px] uppercase tracking-hud text-accent-solar">
          {fixture.display} · {fixture.time}
        </span>
      </div>

      <p className="mt-3 font-cond text-xl leading-tight text-fg sm:text-2xl">{fixture.title}</p>
      <p className="mt-1 text-sm text-fg/70">{fixture.venue}</p>

      <div
        className="mt-6 flex items-end gap-5 sm:gap-8"
        role="timer"
        aria-label={
          live
            ? `${fixture.title} is happening now`
            : `${days} days, ${hours} hours and ${minutes} minutes until ${fixture.title}`
        }
      >
        <Unit value={days} label="Days" />
        <span aria-hidden="true" className="pb-4 font-cond text-2xl text-fg/30">:</span>
        <Unit value={hours} label="Hrs" />
        <span aria-hidden="true" className="pb-4 font-cond text-2xl text-fg/30">:</span>
        <Unit value={minutes} label="Min" />
        <span aria-hidden="true" className="pb-4 font-cond text-2xl text-fg/30">:</span>
        <Unit value={seconds} label="Sec" />
      </div>
    </div>
  );
}

const container = {
  hidden: {},
  show: { transition: { delayChildren: 0.35, staggerChildren: 0.09 } },
};

export default function Hero() {
  const reduced = useReducedMotion();
  const accentRef = useSectionAccent(ACCENTS.azure.hex);

  /* Scroll-out choreography: the three lines of the tagline part company as
     the stadium takes over the frame. Sprung, so a flick of the wheel lands
     as a swell rather than a jump. */
  const { scrollYProgress } = useScroll({ target: accentRef, offset: ['start start', 'end start'] });
  const exit = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.6, restDelta: 0.0005 });
  const lineShift = [
    useTransform(exit, [0, 1], [0, -140]),
    useTransform(exit, [0, 1], [0, 110]),
    useTransform(exit, [0, 1], [0, -80]),
  ];
  const copyLift = useTransform(exit, [0, 1], [0, -90]);
  const copyFade = useTransform(exit, [0, 0.75], [1, 0]);
  const cardLift = useTransform(exit, [0, 1], [0, -40]);

  const item = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: DURATION.base } } }
    : {
        hidden: { opacity: 0, y: 26, filter: 'blur(10px)' },
        show: {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          transition: { duration: DURATION.slow, ease: EASE.luxe },
        },
      };

  return (
    <section
      ref={accentRef}
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-x-clip pb-16 pt-28 sm:pt-32"
    >
      <div className="shell">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={reduced ? undefined : { y: copyLift, opacity: copyFade }}
          className="max-w-4xl"
        >
          {/* Eyebrow with a live pulse dot */}
          <motion.div variants={item} className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-phthalo-400 opacity-75 motion-safe:animate-pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-phthalo-400" />
            </span>
            <span className="hud-label !text-white/80">{HERO.eyebrow}</span>
          </motion.div>

          {/* the company's own corporate tagline, set as the headline. It already reads
              as a competitive statement — the season just says it louder. */}
          <h1 className="mt-7" aria-label={`${HERO.titleLines.join(' ')} — ${HERO.season}`}>
            {HERO.titleLines.map((line, i) => (
              <motion.span
                key={line}
                aria-hidden="true"
                style={reduced ? undefined : { x: lineShift[i] }}
                className="block overflow-hidden pb-[0.08em]"
              >
                <motion.span
                  initial={reduced ? { opacity: 0 } : { y: '110%' }}
                  animate={reduced ? { opacity: 1 } : { y: '0%' }}
                  transition={{
                    duration: DURATION.epic,
                    ease: EASE.luxe,
                    delay: 0.45 + i * 0.12,
                  }}
                  className={`display-title block text-[clamp(2.6rem,9vw,7.6rem)] ${
                    i === 1 ? 'text-magenta-400 glow-magenta' : 'text-white'
                  }`}
                >
                  {line}
                </motion.span>
              </motion.span>
            ))}
          </h1>

          <motion.p
            variants={item}
            className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-cond text-base uppercase tracking-wider2 text-white/80 sm:text-lg"
          >
            <span className="text-azure-300">{COMPANY.portal}</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-solar-500" />
            <span>Annual Events</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-solar-500" />
            <span>{COMPANY.season}</span>
          </motion.p>

          <motion.p
            variants={item}
            className="mt-7 max-w-2xl text-balance text-base leading-relaxed text-white/80 [text-shadow:0_1px_14px_rgba(5,4,10,0.85)] sm:text-lg"
          >
            {HERO.lede}
          </motion.p>

          {/* Actions */}
          <motion.div variants={item} className="mt-10 flex flex-wrap items-center gap-4">
            <MagneticButton href="#register" className="btn-primary">
              Take part this season
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M1 8h13M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MagneticButton>
            <MagneticButton href="#events" className="btn-ghost !text-white/90" strength={0.2}>
              Explore the season
            </MagneticButton>
          </motion.div>
        </motion.div>

        {/* Countdown + season vitals, in their own band at the foot of the viewport. */}
        <motion.div
          variants={item}
          initial="hidden"
          animate="show"
          transition={{ delay: 1.1, duration: DURATION.slow, ease: EASE.luxe }}
          style={reduced ? undefined : { y: cardLift }}
          className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-fg/10 bg-fg/[0.07] lg:mt-20 lg:grid-cols-[1.15fr_1fr]"
        >
          <NextFixture />

          <div className="grid grid-cols-2 gap-px bg-fg/[0.07] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {HERO.stats.map((stat) => (
              <div key={stat.k} className="bg-surface-raised/75 px-5 py-6 backdrop-blur-xl">
                <Counter
                  value={stat.v}
                  suffix={stat.suffix}
                  className="block font-display text-3xl text-fg sm:text-4xl"
                />
                <span className="mt-2 block font-mono text-[10px] uppercase tracking-hud text-fg/68">
                  {stat.k}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: DURATION.slow }}
        className="pointer-events-none absolute inset-x-0 bottom-5 hidden justify-center lg:flex"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-hud text-white/60">Scroll</span>
          <span className="relative block h-10 w-px overflow-hidden bg-white/15">
            <motion.span
              animate={reduced ? undefined : { y: ['-100%', '100%'] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: EASE.smooth }}
              className="absolute inset-x-0 block h-1/2 bg-solar-400"
            />
          </span>
        </div>
      </motion.div>

      <span className="sr-only">
        {COMPANY.name} — {COMPANY.tagline}
      </span>
    </section>
  );
}
