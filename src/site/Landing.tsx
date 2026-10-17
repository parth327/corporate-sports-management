import { startTransition, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import StadiumBackdrop from '@/three/StadiumBackdrop';
import Nav from '@/components/Nav.jsx';
import Hero from '@/components/Hero.jsx';
import Ticker from '@/components/Ticker.jsx';
import AboutCompany from '@/components/AboutCompany.jsx';
import Pillars from '@/components/Pillars.jsx';
import Heritage from '@/components/Heritage.jsx';
import Events from '@/components/Events.jsx';
import Spotlight from '@/components/Spotlight.jsx';
import Calendar from '@/components/Calendar.jsx';
import Standings from '@/components/Standings.jsx';
import Gallery from '@/components/Gallery.jsx';
import Footer from '@/components/Footer.jsx';
import ScrollProgress from '@/components/ui/ScrollProgress.jsx';
import { installSignalListeners } from '@/lib/signals.js';
import { DURATION, EASE } from '@/lib/motion.js';
import { useGraphicsTier, useScrolled } from '@/lib/hooks.js';
import { anchorId, useSmoothScroll } from '@/lib/smoothScroll';
import { useNarrativeTracker } from '@/lib/narrative';
import ChapterRail from './ChapterRail';
import RegisterCta from './RegisterCta';

/**
 * The public face of the portal: one long scroll through the season, with a
 * procedural stadium behind it whose camera follows the story section by
 * section.
 *
 * Layering contract — every value is non-negative, deliberately:
 *   z-0   StadiumBackdrop. Fixed WebGL stadium, pointer-events-none end to end.
 *   z-[5] Readability scrim + film grain. Also inert.
 *   z-10  The document itself.
 *   z-30+ Nav, chapter rail, drawer, lightbox, scroll progress.
 *
 * Nothing may take a negative z-index. `#root` and `<body>` establish no
 * stacking context, so a negative layer would paint *and hit-test* behind them,
 * and every wheel event would land on `#root` instead of the page.
 */
export default function Landing() {
  const { reduced } = useGraphicsTier();
  useEffect(installSignalListeners, []);
  useSmoothScroll(!reduced);
  useNarrativeTracker();

  return (
    <div id="site-root">
      <ScrollProgress />
      <StadiumBackdrop />
      <Scrim />
      <Nav />
      <ChapterRail />

      <main className="relative z-10">
        <Hero />
        <Ticker />
        <AfterFirstPaint>
          <AboutCompany />
          <Pillars />
          <Heritage />
          <Events />
          <Spotlight />
          <Calendar />
          <Standings />
          <Gallery />
          <RegisterCta />
        </AfterFirstPaint>
      </main>

      <div className="relative z-10">
        <AfterFirstPaint>
          <Footer />
        </AfterFirstPaint>
      </div>

      <BackToTop />
    </div>
  );
}

/**
 * Renders everything below the fold in a transition after the hero has
 * painted. React time-slices transition renders, so the long page mounts in
 * small interruptible pieces instead of one main-thread block that holds up
 * the first paint and input on a phone.
 */
function AfterFirstPaint({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startTransition(() => setReady(true));
  }, []);

  /* A deep link like /#calendar points at a section that did not exist when the browser looked for it. */
  useEffect(() => {
    if (!ready || !window.location.hash) return;
    document.getElementById(anchorId(window.location.hash.slice(1)))?.scrollIntoView();
  }, [ready]);

  return ready ? <>{children}</> : null;
}

/**
 * The stadium is the whole view at the top of the page; once the reading
 * starts it dims behind the copy. The left-hand wash keeps the hero headline
 * legible over whatever the camera is looking at.
 */
function Scrim() {
  const { scrollY } = useScroll();
  const dim = useTransform(scrollY, [0, 560], [0.12, 0.6]);
  const wash = useTransform(scrollY, [0, 640], [1, 0.3]);

  return (
    <>
      <motion.div
        aria-hidden="true"
        style={{ opacity: dim }}
        className="pointer-events-none fixed inset-0 z-[5] bg-[#07060b]"
      />
      <motion.div
        aria-hidden="true"
        style={{ opacity: wash }}
        className="pointer-events-none fixed inset-y-0 left-0 z-[5] w-full bg-gradient-to-r from-[#07060b]/80 via-[#07060b]/35 to-transparent lg:w-[62%]"
      />
      <div
        aria-hidden="true"
        className="grain pointer-events-none fixed inset-0 z-[5] bg-gradient-to-b from-transparent via-transparent to-[#07060b]/55"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(5,4,10,0.6)_100%)]"
      />
    </>
  );
}

/** Appears once the hero is well out of frame. */
function BackToTop() {
  const scrolled = useScrolled(900);

  return (
    <AnimatePresence>
      {scrolled && (
        <motion.a
          href="#top"
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: DURATION.fast, ease: EASE.luxe }}
          whileHover={{ y: -3 }}
          aria-label="Back to top"
          className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full border border-fg/22 bg-surface-raised/80 text-fg/86 backdrop-blur-xl transition-colors hover:border-solar-400 hover:text-accent-solar sm:bottom-8 sm:right-8"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 13V3M3 8l5-5 5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
