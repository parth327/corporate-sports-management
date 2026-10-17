import { useEffect, useRef, useState } from 'react';
import { themeSignal } from './signals.js';
import { nextFixture } from './site-data.js';
import { setSmoothScrollPaused } from './smoothScroll';

/** Matches a media query and stays in sync with it. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * How hard the stadium is allowed to push the GPU.
 *
 * A phone rendering the same seat count and bloom pass as a workstation drops
 * frames and drains the battery, so the scene reads this and scales itself
 * down rather than shipping a separate mobile build.
 */
export function useGraphicsTier() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(max-width: 1279px)');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const coarse = useMediaQuery('(pointer: coarse)');

  if (reduced) return { tier: 'minimal', reduced: true, coarse };
  if (isMobile) return { tier: 'low', reduced: false, coarse };
  if (isTablet || coarse) return { tier: 'mid', reduced: false, coarse };
  return { tier: 'high', reduced: false, coarse };
}

/**
 * Publishes an accent colour to the stadium lighting while the returned ref
 * is on screen. The arena literally changes colour as you move between the
 * cricket section and the Cultural section.
 */
export function useSectionAccent(hex) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !hex) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) themeSignal.set(hex);
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hex]);

  return ref;
}

function remaining(target) {
  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, live: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    live: false,
  };
}

/**
 * Live countdown to the next fixture on the calendar.
 *
 * Ticks once a second, so call it from the smallest component that shows the
 * clock — anything above it re-renders on every tick too.
 */
export function useCountdown() {
  const [fixture] = useState(nextFixture);
  const target = new Date(`${fixture.date}T${fixture.time ?? '09:00'}:00`).getTime();
  const [time, setTime] = useState(() => remaining(target));

  useEffect(() => {
    if (time.live) return undefined;
    const id = setInterval(() => setTime(remaining(target)), 1000);
    return () => clearInterval(id);
  }, [target, time.live]);

  return { ...time, fixture };
}

/** True once the page has scrolled past `threshold` pixels. */
export function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}

/** Locks page scroll while a modal or drawer is open, including the smooth scroller. */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setSmoothScrollPaused(true);
    return () => {
      document.body.style.overflow = previous;
      setSmoothScrollPaused(false);
    };
  }, [locked]);
}
