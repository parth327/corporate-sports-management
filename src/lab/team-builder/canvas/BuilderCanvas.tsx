import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ARENA_BG } from '../theme';
import { CameraRig } from './CameraRig';
import { DropFX } from './DropFX';
import { Effects, QUALITIES, liveComposer, type Quality } from './Effects';
import { FormationNodes } from './FormationNodes';
import { Pitch } from './Pitch';
import { Projector } from './Projector';

/**
 * Integrated, mobile and software renderers, by the unmasked renderer string.
 * Intel Arc is discrete; AMD's integrated parts name themselves "Radeon …
 * Graphics" (Radeon(TM) Graphics, Vega 8 Graphics, 780M Graphics), unlike RX
 * and Pro cards.
 */
const MODEST_GPU =
  /Intel(?!.*\bArc\b)|Radeon(?!.*\b(RX|Pro)\b).*Graphics|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Software|Basic Render/i;

/** Names the GPU from a throwaway context, released at once. Empty when the browser will not say. */
function rendererName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/**
 * Where the ladder starts. Depth of field costs as much as everything else
 * together, and starting above what a GPU can hold means the arrival move
 * plays at half rate until the monitor steps down; so touch devices and
 * integrated GPUs start without it. `?quality=` overrides.
 */
function initialQuality(): Quality {
  const requested = new URLSearchParams(window.location.search).get('quality');
  if (QUALITIES.includes(requested as Quality)) return requested as Quality;
  if (window.matchMedia('(pointer: coarse)').matches) return 'medium';
  return MODEST_GPU.test(rendererName()) ? 'medium' : 'high';
}

/** Direction reversals the monitor may make before settling on the lower of the two levels it keeps swapping between. */
const MAX_REVERSALS = 3;

/**
 * Development hook for measuring the canvas from outside, as the stadium has.
 * The renderer's counters reset on every render call and the composer makes
 * several a frame, so auto-reset is off and the totals are read at the start
 * of the next frame. A negative priority on purpose: a positive one would
 * tell R3F this component renders the frame, and without a composer (the
 * minimal tier) nothing would.
 */
function DevStats({ quality }: { quality: Quality }) {
  const gl = useThree((state) => state.gl);
  const frame = useRef({ calls: 0, triangles: 0 });

  useEffect(() => {
    gl.info.autoReset = false;
    const target = window as unknown as { __teamBuilder?: unknown };
    target.__teamBuilder = {
      stats: () => ({
        quality,
        dpr: gl.getPixelRatio(),
        width: gl.domElement.width,
        height: gl.domElement.height,
        calls: frame.current.calls,
        triangles: frame.current.triangles,
        programs: gl.info.programs?.length ?? 0,
        composerWidth: liveComposer.current?.inputBuffer.width ?? null,
      }),
    };
    return () => {
      gl.info.autoReset = true;
      delete target.__teamBuilder;
    };
  }, [gl, quality]);

  useFrame(() => {
    frame.current.calls = gl.info.render.calls;
    frame.current.triangles = gl.info.render.triangles;
    gl.info.reset();
  }, -3);

  return null;
}

/** Shader compilation and the arrival move make the first seconds slow on any machine; judge frame rate after them. */
const WARM_UP_MS = 3500;

/**
 * The WebGL half of the team builder.
 *
 * Adaptive: the performance monitor walks the pixel ratio down a quarter step
 * at a time while frames miss the display's rate, and once it reaches 1× it
 * sheds depth of field, then drops to the light tier. It walks back up the
 * pixel ratio when there is headroom, but never re-adds a pass it shed, so it
 * cannot oscillate between compiling and dropping one.
 */
export default function BuilderCanvas({ reduced, onLost }: { reduced: boolean; onLost: () => void }) {
  const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  const [quality, setQuality] = useState<Quality>(initialQuality);
  const [dpr, setDpr] = useState(() => Math.min(maxDpr, 1.5));

  const live = useRef({ quality, dpr });
  live.current = { quality, dpr };
  const tuning = useRef({ direction: 0, reversals: 0, settled: false });

  /* `?monitor=off` pins the quality where it starts, for profiling one configuration at a time. */
  const [monitoring, setMonitoring] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('monitor') === 'off') return undefined;
    const id = window.setTimeout(() => setMonitoring(true), WARM_UP_MS);
    return () => window.clearTimeout(id);
  }, []);

  const adjust = useCallback(
    (direction: 1 | -1) => {
      const t = tuning.current;
      if (t.settled) return;
      if (t.direction !== 0 && direction !== t.direction) t.reversals += 1;
      t.direction = direction;
      if (t.reversals >= MAX_REVERSALS) {
        t.settled = true;
        if (direction > 0) return;
      }
      const { quality: q, dpr: d } = live.current;
      if (direction > 0) {
        if (d < maxDpr) setDpr(Math.min(maxDpr, d + 0.25));
        return;
      }
      if (d > 1) setDpr(Math.max(1, d - 0.25));
      else if (q !== 'minimal') setQuality(QUALITIES[QUALITIES.indexOf(q) - 1]!);
      else if (d > 0.75) setDpr(0.75);
    },
    [maxDpr],
  );

  return (
    <Canvas
      flat
      dpr={dpr}
      gl={{ antialias: false, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' }}
      camera={{ fov: 38, near: 1, far: 1400, position: [0, 110, 170] }}
      onCreated={({ gl }) => {
        gl.setClearColor(ARENA_BG);
        /* A lost GPU does not throw, so no error boundary sees it: hand over to the flat pitch explicitly. */
        gl.domElement.addEventListener('webglcontextlost', onLost, { once: true });
      }}
    >
      <color attach="background" args={[ARENA_BG]} />
      <fog attach="fog" args={[ARENA_BG, 170, 560]} />
      {monitoring && (
        <PerformanceMonitor
          bounds={(refreshRate) => (refreshRate > 90 ? [80, 110] : [52, 58])}
          onIncline={() => adjust(1)}
          onDecline={() => adjust(-1)}
        />
      )}
      <CameraRig reduced={reduced} />
      <Pitch reduced={reduced} />
      <FormationNodes reduced={reduced} />
      <DropFX reduced={reduced} />
      <Projector />
      <Effects quality={quality} reduced={reduced} />
      {import.meta.env.DEV && <DevStats quality={quality} />}
    </Canvas>
  );
}
