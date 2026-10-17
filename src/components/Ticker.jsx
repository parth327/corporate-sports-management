import { TICKER_ITEMS } from '../lib/site-data.js';

/**
 * Kinetic announcement strip.
 *
 * Driven by a CSS keyframe rather than a framer loop: this runs for the entire
 * life of the page, and a compositor-only CSS animation keeps the main thread
 * completely free for the scroll handler and the WebGL frame loop.
 *
 * The list is rendered twice and travels exactly -50%, which is what makes the
 * wrap seamless — at the halfway point the second copy sits precisely where the
 * first one started. The second copy is hidden from assistive tech so each
 * announcement is read once.
 */
export default function Ticker() {
  return (
    <div className="relative border-y border-fg/10 bg-surface-raised/70 py-4 backdrop-blur-md">
      <div className="edge-mask pause-on-hover flex w-full overflow-hidden">
        <div className="flex shrink-0 items-center gap-10 whitespace-nowrap pr-10 motion-safe:animate-marquee">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 ? 'true' : undefined} className="flex items-center gap-10">
              {TICKER_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-10">
                  <span className="font-cond text-base uppercase tracking-wider2 text-fg/80">{item}</span>
                  <span className="h-1.5 w-1.5 rotate-45 bg-solar-500/70" aria-hidden="true" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
