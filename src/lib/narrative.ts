import { useEffect, useSyncExternalStore } from 'react';
import { SHOTS, arrivalOffsets, chapterAt, shotProgress } from '@/three/stadium/choreography';

/**
 * Scroll position -> which chapter of the page is on screen.
 *
 * Lives on the DOM side so the chapter rail works with or without WebGL. The
 * stadium reads `narrative.progress` from its frame loop; React only hears
 * about it when the whole-number chapter changes.
 */
export const narrative = {
  /** Continuous shot index, 0 .. SHOTS.length - 1. */
  progress: 0,
  chapter: 0,
};

const listeners = new Set<() => void>();

function publish(progress: number) {
  narrative.progress = progress;
  const chapter = chapterAt(progress);
  if (chapter !== narrative.chapter) {
    narrative.chapter = chapter;
    listeners.forEach((listener) => listener());
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChapter(): number {
  return useSyncExternalStore(subscribe, () => narrative.chapter, () => 0);
}

/** Mount once on the landing page. Measures the anchored sections and tracks scroll against them. */
export function useNarrativeTracker(): void {
  useEffect(() => {
    let arrivals: number[] = SHOTS.map(() => 0);

    const measure = () => {
      const tops = SHOTS.map(({ anchor }) => {
        const el = document.getElementById(anchor);
        return el ? el.getBoundingClientRect().top + window.scrollY : null;
      });
      arrivals = arrivalOffsets(tops, window.innerHeight);
      publish(shotProgress(window.scrollY, arrivals));
    };

    const onScroll = () => publish(shotProgress(window.scrollY, arrivals));

    measure();
    /* Section heights move as images, fonts and filtered grids settle, so re-measure on any body resize. */
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, []);
}
