import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ArenaBackdrop from './three/ArenaBackdrop.jsx';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import Ticker from './components/Ticker.jsx';
import Pillars from './components/Pillars.jsx';
import Heritage from './components/Heritage.jsx';
import Events from './components/Events.jsx';
import Spotlight from './components/Spotlight.jsx';
import Calendar from './components/Calendar.jsx';
import Standings from './components/Standings.jsx';
import Gallery from './components/Gallery.jsx';
import Register from './components/Register.jsx';
import Footer from './components/Footer.jsx';
import ScrollProgress from './components/ui/ScrollProgress.jsx';
import { installSignalListeners } from './lib/signals.js';
import { DURATION, EASE } from './lib/motion.js';
import { useScrolled } from './lib/hooks.js';

/**
 * Composition root for the Corporate Sports Events Management portal.
 *
 * Layering contract — every value is non-negative, deliberately:
 *   z-0   ArenaBackdrop. Fixed WebGL arena, pointer-events-none end to end.
 *   z-[5] Readability scrim + film grain. Also inert.
 *   z-10  The document itself. Native scrolling, nothing hijacked.
 *   z-30+ Nav, drawer, lightbox, scroll progress.
 *
 * Nothing may take a negative z-index. `#root` and `<body>` establish no
 * stacking context, so a negative layer would paint *and hit-test* behind them,
 * and every wheel event would land on `#root` instead of the page.
 */
export default function App() {
  useEffect(installSignalListeners, []);

  return (
    <>
      <ScrollProgress />
      <ArenaBackdrop />

      {/* Readability scrim. The arena is beautiful but it is a backdrop — copy
          has to win. Grain on top so the big gradients never band. */}
      <div
        aria-hidden="true"
        className="grain pointer-events-none fixed inset-0 z-[5] bg-gradient-to-b from-ink-900/35 via-ink-900/55 to-ink-900/80"
      />

      <Nav />

      <main className="relative z-10">
        <Hero />
        <Ticker />
        <Pillars />
        <Heritage />
        <Events />
        <Spotlight />
        <Calendar />
        <Standings />
        <Gallery />
        <Register />
      </main>

      <div className="relative z-10">
        <Footer />
      </div>

      <BackToTop />
    </>
  );
}

/** Appears once the hero is well out of frame. */
function BackToTop() {
  const scrolled = useScrolled(900);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

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
          className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-ink-800/80 text-white/70 backdrop-blur-xl transition-colors hover:border-gold-400 hover:text-gold-400 sm:bottom-8 sm:right-8"
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
