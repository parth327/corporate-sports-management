import clsx from 'clsx';
import { motion, useScroll, useSpring } from 'framer-motion';
import { SHOTS } from '@/three/stadium/choreography';
import { useChapter } from '@/lib/narrative';
import { SPRING } from '@/lib/motion.js';

/**
 * The page's chapters, as a spine down the right edge on wide screens.
 *
 * It reads the same shot list the stadium camera flies, so the chapter named
 * here is always the one the camera is framing. Plain in-page links: the
 * smooth scroller animates them, and they still work without JavaScript.
 */
export default function ChapterRail() {
  const chapter = useChapter();
  const { scrollYProgress } = useScroll();
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });

  return (
    /*
     * Inert except where something is visible. The hidden labels keep their
     * layout, so without this the rail's box (as wide as its longest label) is
     * a transparent block of links over the right edge of the page content.
     * The dots always take the pointer; a label takes it only while shown.
     */
    <nav
      aria-label="Chapters"
      className="pointer-events-none fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 xl:block 2xl:right-6"
    >
      <ol className="relative flex flex-col gap-2.5">
        <span aria-hidden="true" className="absolute bottom-2 right-[11px] top-2 w-px bg-white/15" />
        <motion.span
          aria-hidden="true"
          style={{ scaleY: fill }}
          className="absolute bottom-2 right-[11px] top-2 w-px origin-top bg-spectrum-y"
        />
        {SHOTS.map((shot, index) => {
          const active = index === chapter;
          return (
            <li key={shot.anchor}>
              <a
                href={`#${shot.anchor}`}
                aria-current={active ? 'location' : undefined}
                className="group flex items-center justify-end gap-3 rounded-full py-0.5 pl-3 focus-visible:outline-offset-2"
              >
                <span
                  className={clsx(
                    'whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-hud transition-all duration-300',
                    active
                      ? 'pointer-events-auto bg-ink-900/70 text-white opacity-100 backdrop-blur-md'
                      : 'translate-x-1 bg-ink-900/70 text-white/85 opacity-0 backdrop-blur-md group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100',
                  )}
                >
                  <span className="mr-1.5 text-white/60">{String(index + 1).padStart(2, '0')}</span>
                  {shot.chapter}
                </span>
                <span className="pointer-events-auto relative grid h-6 w-6 shrink-0 place-items-center">
                  {active && (
                    <motion.span
                      layoutId="chapter-marker"
                      transition={SPRING.settle}
                      className="absolute inset-[5px] rounded-full border border-solar-400 bg-solar-400/25"
                    />
                  )}
                  <span
                    className={clsx(
                      'relative h-1.5 w-1.5 rounded-full transition-colors duration-300',
                      active ? 'bg-solar-400' : 'bg-white/55 group-hover:bg-white',
                    )}
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
