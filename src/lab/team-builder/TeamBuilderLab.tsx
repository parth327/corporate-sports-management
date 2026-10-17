import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cancelDrag, groundEverything, resetInteraction } from './interaction/dragController';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useTrackedRect } from './hooks/useSpatial';
import { useBuilder } from './store/builderStore';
import { bridge, drag, type CardVariant } from './store/spatialBridge';
import { ARENA_BG } from './theme';
import { Announcer } from './ui/Announcer';
import { DragGhost } from './ui/DragGhost';
import { FlatPitch } from './ui/FlatPitch';
import { Hint } from './ui/Hint';
import { RosterPanel } from './ui/RosterPanel';
import { SlotLayer } from './ui/SlotLayer';
import { CompactActions, SquadHud } from './ui/SquadHud';

/* The scene is its own chunk: the glass UI mounts first, and a failed load or a lost GPU stays inside the boundary. */
const BuilderCanvas = lazy(() => import('./canvas/BuilderCanvas'));

/** Room the one-line hint takes at the foot of the pitch. */
const HINT_ALLOWANCE = 52;

/** No WebGL, a lost GPU or a failed chunk: the pitch is drawn flat and everything else works as before. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <FlatPitch /> : this.props.children;
  }
}

/**
 * Tells the camera how much of the canvas each glass panel covers, so it can
 * frame the formation in the clear part. Rounded to whole pixels: the camera
 * re-solves on every change, and sub-pixel jitter would keep it moving.
 */
function usePanelInsets(
  wide: boolean,
  stage: RefObject<HTMLElement>,
  panels: { roster: RefObject<HTMLElement>; hud: RefObject<HTMLElement>; actions: RefObject<HTMLElement> },
) {
  useEffect(() => {
    const measure = () => {
      const s = stage.current?.getBoundingClientRect();
      if (!s) return;
      const roster = panels.roster.current?.getBoundingClientRect();
      const hud = panels.hud.current?.getBoundingClientRect();
      const actions = panels.actions.current?.getBoundingClientRect();
      const insets = bridge.insets;
      insets.top = hud ? Math.round(Math.max(0, hud.bottom - s.top)) : 0;
      insets.left = wide && roster ? Math.round(Math.max(0, roster.right - s.left)) : 0;
      /* The hint sits at the foot of the pitch in both layouts; on phones, above the squad strip. */
      insets.bottom = (wide || !roster ? 0 : Math.round(Math.max(0, s.bottom - roster.top))) + HINT_ALLOWANCE;
      insets.right = actions && actions.width > 0 ? Math.round(Math.max(0, s.right - actions.left)) : 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    [stage, panels.roster, panels.hud, panels.actions].forEach((ref) => ref.current && observer.observe(ref.current));
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [wide, stage, panels.roster, panels.hud, panels.actions]);
}

/**
 * /lab/team-builder — the spatial team builder.
 *
 * Three layers, back to front:
 *   the WebGL arena (full-bleed, so the glass has something to blur),
 *   the slot layer (a DOM button pinned to every node, for keyboard and touch),
 *   the glass UI (roster, HUD, hint), then the ghost card in flight above all.
 *
 * Front-end only: the squad is local data and nothing is saved.
 */
export default function TeamBuilderLab() {
  const reduced = useReducedMotion() ?? false;
  const wide = useMediaQuery('(min-width: 1024px)');
  const touch = useMediaQuery('(pointer: coarse)');
  const variant: CardVariant = wide ? 'rail' : 'strip';

  /* A GPU lost mid-session: the canvas goes, the flat pitch takes over, the lineup and UI carry on. */
  const [glLost, setGlLost] = useState(false);
  const onLost = useCallback(() => {
    groundEverything();
    setGlLost(true);
  }, []);

  const stage = useRef<HTMLDivElement>(null);
  const roster = useRef<HTMLElement>(null);
  const hud = useRef<HTMLElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const panels = useRef({ roster, hud, actions }).current;

  useTrackedRect(stage, bridge.rect);
  /* The roster is a different element in each layout; re-track it when the layout flips. */
  useTrackedRect(roster, bridge.roster, variant);
  usePanelInsets(wide, stage, panels);

  useEffect(() => {
    bridge.reducedMotion = reduced;
  }, [reduced]);

  useEffect(() => {
    drag.variant = variant;
  }, [variant]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Team Builder · Sports Events Lab';
    return () => {
      document.title = previous;
      resetInteraction();
    };
  }, []);

  /* Escape backs out of whatever is in progress: a drag first, then a pick. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (drag.active) {
        cancelDrag();
        return;
      }
      const state = useBuilder.getState();
      if (state.selected === null && state.targetSlot < 0) return;
      const picked = state.selected !== null;
      state.select(null);
      /* Hand focus back to what the player was picked up from, card or chip, scrolled into view in its list. */
      const origin = bridge.pickOrigin;
      bridge.pickOrigin = null;
      if (picked && origin?.isConnected) {
        origin.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        origin.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* The whole lab is the page's main content: the pitch buttons as much as the panels. */
  return (
    <main className="tb-root fixed inset-0 overflow-hidden font-sans text-white" style={{ background: ARENA_BG }}>
      <div ref={stage} className="absolute inset-0" aria-hidden="true">
        {glLost ? (
          <FlatPitch />
        ) : (
          <CanvasBoundary>
            <Suspense fallback={null}>
              <BuilderCanvas reduced={reduced} onLost={onLost} />
            </Suspense>
          </CanvasBoundary>
        )}
      </div>

      <SlotLayer />

      <div
        className={
          wide
            ? 'pointer-events-none absolute inset-0 z-20 grid grid-cols-[clamp(19rem,14rem+10vw,30rem)_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-[var(--tb-gap)] p-[var(--tb-gap)]'
            : 'pointer-events-none absolute inset-0 z-20 flex flex-col gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]'
        }
      >
        {wide ? (
          <>
            <div className="row-span-3 min-h-0">
              <RosterPanel ref={roster} variant="rail" />
            </div>
            <SquadHud ref={hud} compact={false} />
            <div aria-hidden="true" />
            <Hint touch={touch} />
          </>
        ) : (
          <>
            <SquadHud ref={hud} compact />
            <div className="relative min-h-0 flex-1">
              <div className="absolute bottom-2 right-0">
                <CompactActions ref={actions} />
              </div>
              <div className="absolute inset-x-0 bottom-2 flex justify-center pr-14 sm:pr-0">
                <Hint touch={touch} />
              </div>
            </div>
            <div className="-mx-2 shrink-0">
              <RosterPanel ref={roster} variant="strip" />
            </div>
          </>
        )}
      </div>

      <DragGhost />
      <Announcer />
    </main>
  );
}
