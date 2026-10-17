import { Component, Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useGraphicsTier } from '@/lib/hooks.js';
import type { GraphicsTier } from './stadium/StadiumCanvas';

const StadiumCanvas = lazy(() => import('./stadium/StadiumCanvas'));

/** Probes for WebGL 2, then hands the probe context straight back: browsers cap live contexts, and phones start theirs on engagement. */
function supportsWebGL(): boolean {
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

/** A failed chunk load or a lost GPU must not take the page down; the CSS stand-in simply stays. */
class Contained extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The fixed stadium the landing page scrolls over.
 *
 * Layering rules, both learned the hard way (see README):
 *  1. pointer-events: none on the wrapper AND the canvas, or wheel and touch
 *     events land on the canvas and the page stops scrolling;
 *  2. no negative z-index anywhere — z-0 here, content at z-10.
 *
 * three.js is the heaviest thing on the page, so it is fetched only once the
 * browser is idle after first paint (on phones, once the visitor engages).
 * Until the first frame is drawn a CSS night-stadium stands in, and the canvas
 * fades in over it.
 */
export default function StadiumBackdrop() {
  const graphics = useGraphicsTier() as GraphicsTier;
  const [webgl] = useState(supportsWebGL);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!webgl || mounted) return undefined;

    /* Phones: parsing three.js and compiling shaders costs a second of main thread on a mid-range
       handset, so the stand-in holds until the visitor first engages (or six seconds pass). */
    if (graphics.tier === 'low') {
      const engage = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'] as const;
      const mount = () => setMounted(true);
      engage.forEach((name) => window.addEventListener(name, mount, { once: true, passive: true }));
      const timer = window.setTimeout(mount, 6000);
      return () => {
        engage.forEach((name) => window.removeEventListener(name, mount));
        window.clearTimeout(timer);
      };
    }

    /* Safari has no requestIdleCallback, whatever lib.dom says. */
    if ((window as Partial<Pick<Window, 'requestIdleCallback'>>).requestIdleCallback) {
      const id = window.requestIdleCallback(() => setMounted(true), { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setMounted(true), 300);
    return () => window.clearTimeout(id);
  }, [webgl, mounted, graphics.tier]);

  const onReady = useCallback(() => setReady(true), []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-[#05040a]">
      <div className="stadium-standin absolute inset-0" />
      {mounted && (
        <Contained>
          <Suspense fallback={null}>
            <div
              className="absolute inset-0 transition-opacity duration-[1600ms] ease-out"
              style={{ opacity: ready ? 1 : 0 }}
            >
              <StadiumCanvas tier={graphics} onReady={onReady} />
            </div>
          </Suspense>
        </Contained>
      )}
    </div>
  );
}
