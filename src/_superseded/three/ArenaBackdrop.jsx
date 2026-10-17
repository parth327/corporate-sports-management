import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import CameraDrift from './CameraDrift.jsx';
import Floodlights from './Floodlights.jsx';
import PigmentClouds from './PigmentClouds.jsx';
import Motes from './Motes.jsx';
import ArenaCore from './ArenaCore.jsx';
import { useGraphicsTier, useMediaQuery } from '../lib/hooks.js';

/**
 * The fixed WebGL backdrop the whole document scrolls over.
 *
 * Two rules keep this layer out of the user's way, and both matter:
 *
 *  1. `pointer-events: none` on BOTH the wrapper and the canvas. A child can
 *     re-enable pointer events even when its parent disables them, and R3F sets
 *     `pointerEvents: 'auto'` on its own container by default — so the canvas
 *     has to opt out explicitly or it swallows wheel and touch events.
 *  2. No negative z-index. `#root` and `<body>` establish no stacking context,
 *     so a negative z-index here would paint and hit-test *behind* them and the
 *     page would stop scrolling entirely. z-0 backdrop, z-10 content.
 *
 * Positioning is passed through `style` rather than `className` because R3F
 * writes its own inline styles onto that element, and inline styles beat
 * classes — a Tailwind `fixed` would be silently overridden by `position:relative`.
 */
export default function ArenaBackdrop() {
  const tier = useGraphicsTier();
  const compact = useMediaQuery('(max-width: 1023px)');

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        style={{ pointerEvents: 'none' }}
        dpr={tier.dpr}
        frameloop={tier.reduced ? 'demand' : 'always'}
        camera={{ position: [0, 0, 17], fov: 52, near: 0.1, far: 260 }}
        gl={{
          antialias: false, // the composer handles edges; MSAA here is wasted fill rate
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <color attach="background" args={['#07060b']} />
        {/* Fog must haze the far lamp arrays at z = -74, never erase them. */}
        <fog attach="fog" args={['#07060b', 40, 190]} />

        {/* Deliberately minimal. Almost everything in the scene is emissive or
            basic — a strong ambient would only lift the blacks and grey out the
            pigment blooms. */}
        <ambientLight intensity={0.12} color="#6b4a80" />

        <Suspense fallback={null}>
          <CameraDrift reduced={tier.reduced} />
          <PigmentClouds reduced={tier.reduced} count={tier.tier === 'low' ? 5 : 8} />
          <Floodlights reduced={tier.reduced} />
          <Motes count={tier.motes} reduced={tier.reduced} />
          <ArenaCore compact={compact} reduced={tier.reduced} />
        </Suspense>

        {tier.bloom && (
          <EffectComposer disableNormalPass multisampling={0}>
            <Bloom intensity={1.5} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
            <Vignette offset={0.22} darkness={0.8} eskil={false} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
