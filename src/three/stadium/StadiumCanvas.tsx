import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { SHOTS } from './choreography';
import { CameraRig } from './CameraRig';
import { Stadium, type RigState, type StadiumQuality } from './Stadium';

export interface GraphicsTier {
  tier: 'high' | 'mid' | 'low' | 'minimal';
  reduced: boolean;
  coarse: boolean;
}

interface TierProfile {
  quality: StadiumQuality;
  dpr: [number, number];
  /** Ceiling on canvas pixels, in millions, however large the screen. */
  megapixels: number;
}

/**
 * What each class of device is asked to draw. A phone gets a third of the
 * seats and a capped pixel ratio; the performance monitor can still step any
 * tier down further at runtime if frames start to drop.
 *
 * There is deliberately no post-processing: every glow is drawn in the scene
 * (additive halos, shafts, emissive lamps). A bloom pass rendered black on an
 * integrated GPU and cost several full-screen passes a frame everywhere else.
 * The megapixel ceiling keeps 4K screens from paying native-resolution fill
 * rate for a backdrop that sits dimmed behind the copy.
 */
const PROFILES: Record<GraphicsTier['tier'], TierProfile> = {
  high: {
    quality: { rowSpacing: 1.1, seatSpacing: 0.95, segments: 256, flashes: 420, beamIntensity: 0.13 },
    dpr: [1, 1.75],
    megapixels: 2.6,
  },
  mid: {
    quality: { rowSpacing: 1.45, seatSpacing: 1.2, segments: 192, flashes: 260, beamIntensity: 0.14 },
    dpr: [1, 1.5],
    megapixels: 2,
  },
  low: {
    quality: { rowSpacing: 2.1, seatSpacing: 1.6, segments: 144, flashes: 140, beamIntensity: 0.17 },
    dpr: [1, 1.5],
    megapixels: 1.4,
  },
  minimal: {
    quality: { rowSpacing: 1.45, seatSpacing: 1.2, segments: 192, flashes: 0, beamIntensity: 0.15 },
    dpr: [1, 1.5],
    megapixels: 2,
  },
};

function useViewportArea(): number {
  const [area, setArea] = useState(() => window.innerWidth * window.innerHeight);
  useEffect(() => {
    const onResize = () => setArea(window.innerWidth * window.innerHeight);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return area;
}

/** Tells the page the first frame is on screen, so the canvas can fade in over the CSS stand-in. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(onReady);
  });
  return null;
}

/** Direction reversals the monitor may make before the ratio is frozen at the lower of the two levels it keeps swapping between. */
const MAX_REVERSALS = 3;

export default function StadiumCanvas({ tier, onReady }: { tier: GraphicsTier; onReady: () => void }) {
  const profile = PROFILES[tier.tier];
  const rig = useMemo<RigState>(() => ({ progress: 0 }), []);

  /* 0..1 of the tier's pixel-ratio range: starts in the middle, walked up or down by the performance monitor. */
  const headroom = useRef(0.55);
  const [dprLevel, setDprLevel] = useState(headroom.current);
  const tuning = useRef({ direction: 0, reversals: 0, settled: false });

  /*
   * drei's own `flipflops` counts every adjustment, not reversals, so a machine
   * that holds 60 Hz and keeps stepping up hits the limit within seconds and
   * `onFallback` would drop it to the floor. Only a real up-down oscillation
   * means the budget sits on a boundary; when it does, settle on the lower side.
   */
  const step = (delta: number) => {
    const t = tuning.current;
    if (t.settled) return;
    const direction = Math.sign(delta);
    if (t.direction !== 0 && direction !== t.direction) t.reversals += 1;
    t.direction = direction;
    const next = Math.min(1, Math.max(0, headroom.current + delta));
    if (t.reversals >= MAX_REVERSALS) {
      t.settled = true;
      if (direction > 0) return;
    }
    if (next === headroom.current) return;
    headroom.current = next;
    setDprLevel(next);
  };

  /* Headroom scales the pixel budget as well as the ratio, so a big screen on a weak GPU can still step down. */
  const area = useViewportArea();
  const [minDpr, maxDpr] = profile.dpr;
  const budget = profile.megapixels * 1e6 * (0.45 + 0.55 * dprLevel);
  /* Never above the screen's own ratio: supersampling a 1x laptop is exactly the cost this budget exists to avoid. */
  const dpr = Math.min(
    minDpr + (maxDpr - minDpr) * dprLevel,
    window.devicePixelRatio || 1,
    Math.sqrt(budget / Math.max(area, 1)),
  );
  const first = SHOTS[0]!;

  return (
    <Canvas
      flat
      dpr={dpr}
      frameloop={tier.reduced ? 'demand' : 'always'}
      style={{ pointerEvents: 'none' }}
      camera={{ position: first.position, fov: first.fov, near: 0.5, far: 2400 }}
      gl={{
        antialias: true,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => gl.setClearColor('#05040a')}
    >
      <fog attach="fog" args={['#0b0913', 170, 720]} />
      {/* Rendering on demand, the gaps between frames are idle time, not slow frames: nothing to measure. */}
      {!tier.reduced && (
        <PerformanceMonitor
          /* drei's default band accepts anything over 40 fps; hold out for a smooth 60 (or 80 on a 120 Hz screen). */
          bounds={(refreshRate) => (refreshRate > 90 ? [80, 110] : [52, 58])}
          onIncline={() => step(0.2)}
          onDecline={() => step(-0.25)}
        />
      )}
      <CameraRig rig={rig} reduced={tier.reduced} pointer={!tier.coarse} />
      <Stadium quality={profile.quality} reduced={tier.reduced} rig={rig} />
      <FirstFrame onReady={onReady} />
    </Canvas>
  );
}
