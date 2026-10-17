import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/**
 * Inertial wheel scrolling for the public page.
 *
 * Lenis animates the real document scroll position, so native `scroll` events,
 * framer's useScroll, sticky positioning and CSS scroll-padding all keep
 * working unchanged. Touch keeps the platform's own momentum (syncTouch off),
 * and a user who prefers reduced motion gets plain native scrolling.
 */
let instance: Lenis | null = null;

/** The element id a URL fragment names. A malformed escape such as `#50%` is taken literally rather than thrown. */
export function anchorId(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** Sends focus to the section a link jumped to, as a native anchor jump would, without a second scroll. */
function focusTarget(target: HTMLElement) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

export function useSmoothScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.085,
      smoothWheel: true,
      syncTouch: false,
      stopInertiaOnNavigate: true,
    });
    instance = lenis;

    /*
     * In-page links are handled here rather than with Lenis' `anchors` option,
     * which starts its own scroll without cancelling the browser's jump. The
     * scroll waits a frame so an overlay closing on the same click has released
     * its scroll lock first.
     */
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
      const id = link?.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(anchorId(id)) : null;
      if (!target) return;

      event.preventDefault();
      requestAnimationFrame(() => {
        lenis.scrollTo(target);
        focusTarget(target);
      });
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      lenis.destroy();
      if (instance === lenis) instance = null;
    };
  }, [enabled]);
}

/** Pauses smooth scrolling while an overlay (menu, lightbox) owns the page. */
export function setSmoothScrollPaused(paused: boolean): void {
  if (!instance) return;
  if (paused) instance.stop();
  else instance.start();
}
