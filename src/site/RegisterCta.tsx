import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DURATION, EASE, VIEWPORT } from '@/lib/motion.js';

/**
 * The landing page's participation section.
 *
 * There is no sign-up any more. Everyone on the ACE payroll is already an
 * participant on the register — the list is fed from the HR API — so this section
 * explains how someone actually gets into an event (talk to your sub-group's
 * Management Team) rather than offering a form that would duplicate a record
 * the system already holds.
 *
 * It keeps `id="register"` because the nav, hero and every event card anchor
 * to it; the anchor is the season's call to action, not a form route.
 */
export default function RegisterCta() {
  return (
    <section id="register" className="shell py-24 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: DURATION.slow, ease: EASE.luxe }}
        className="glass relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12 sm:py-16"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-spectrum"
        />

        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-hud text-accent-solar">
              Entries open · Season 2026
            </p>

            <h2 className="display-title mt-4 text-4xl text-fg sm:text-5xl">
              You are already
              <br />
              <span className="text-accent-solar">on the register</span>
            </h2>

            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-fg/75">
              Every colleague is a participant from the day they join — there is no form to fill
              in. Tell your sub-group's management team which events you want, and they will place
              you in a squad before the fixtures are drawn.
            </p>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                ['No sign-up', 'Your record comes straight from HR'],
                ['Pick your events', 'Cricket, football or Cultural — or all three'],
                ['Placed by people', 'The management team classifies and allocates'],
                ['One squad per event', 'Allocation happens before the draw'],
              ].map(([title, detail]) => (
                <li key={title} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 text-accent-phthalo">
                    ▪
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-fg/92">{title}</span>
                    <span className="block text-[13px] leading-snug text-fg/68">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <motion.div whileHover={{ y: -3 }} transition={{ duration: DURATION.fast, ease: EASE.luxe }}>
              <a
                href="#calendar"
                className="btn-solar w-full justify-center !py-4 text-center text-base"
              >
                See what is on →
              </a>
            </motion.div>

            <Link to="/login" className="btn-ghost w-full justify-center !py-3.5 text-center">
              Console sign in
            </Link>

            <p className="mt-2 text-center text-[12.5px] leading-relaxed text-fg/78">
              Management and event teams sign in here. Everyone else is placed by their sub-group —
              you will be contacted once your squad is drawn.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
