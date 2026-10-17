import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import {
  ChromaticAberrationEffect,
  EffectPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  type DepthOfFieldEffect,
  type EffectComposer as EffectComposerImpl,
} from 'postprocessing';
import * as THREE from 'three';
import { useBuilder } from '../store/builderStore';
import { bridge, drag, fx } from '../store/spatialBridge';
import { NODE_HEIGHT } from './FormationNodes';

/**
 * The adaptive ladder, heaviest first:
 *   high     depth of field + bloom, then chromatic aberration + vignette + tone mapping
 *   medium   the same without depth of field, which alone costs as much as the rest
 *   low      bloom (fewer mip levels) + vignette + tone mapping, all in one pass
 *   minimal  no composer: the renderer tone-maps the scene directly, and the
 *            glow comes only from additive blending
 */
export type Quality = 'minimal' | 'low' | 'medium' | 'high';
export const QUALITIES: Quality[] = ['minimal', 'low', 'medium', 'high'];

/** The live composer, read by the development stats hook to confirm its buffers track the pixel ratio. */
export const liveComposer: { current: EffectComposerImpl | null } = { current: null };

/* Stable references: the wrappers rebuild an effect whenever a prop's JSON changes, so these never do. */
const FOCUS_SEED: [number, number, number] = [0, NODE_HEIGHT, 12];

/** Where the eye rests when nothing is in hand: the middle of the formation. */
const REST = new THREE.Vector3(0, NODE_HEIGHT * 0.5, 12);

const VIGNETTE = { offset: 0.26, darkness: 0.7 } as const;

const decayKick = (delta: number) => {
  fx.kick *= Math.exp(-Math.min(delta, 1 / 20) * 5.5);
};

/**
 * The lightest tier: no passes at all, so the renderer itself has to tone-map.
 * Asserted every frame rather than set once: when the ladder drops here at
 * runtime, the composer unmounting in the same commit restores the value it
 * saved (none; the canvas is flat) after this component has mounted.
 */
function DirectToneMapping() {
  const gl = useThree((state) => state.gl);
  useEffect(
    () => () => {
      gl.toneMapping = THREE.NoToneMapping;
    },
    [gl],
  );
  useFrame((_, delta) => {
    if (gl.toneMapping !== THREE.ACESFilmicToneMapping) gl.toneMapping = THREE.ACESFilmicToneMapping;
    decayKick(delta);
  });
  return null;
}

/**
 * Chromatic aberration, vignette and tone mapping as ONE full-screen pass.
 *
 * Aberration samples its input at offsets, so it has to run in a pass after
 * bloom (or the red and blue channels would miss the glow), and the wrapper's
 * <ChromaticAberration> always gets a pass to itself, with vignette and tone
 * mapping in another. postprocessing allows one such effect per pass, so this
 * builds that pass by hand with the same effects: one full-screen pass fewer,
 * which on the integrated GPU this was tuned on was the difference between 51
 * and 60 frames a second.
 */
function LensPass({ aberration }: { aberration: { current: ChromaticAberrationEffect | null } }) {
  const camera = useThree((state) => state.camera);
  const lens = useMemo(() => {
    const chromatic = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0, 0),
      radialModulation: true,
      modulationOffset: 0.2,
    });
    const pass = new EffectPass(
      camera,
      chromatic,
      new VignetteEffect(VIGNETTE),
      new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
    );
    return { chromatic, pass };
  }, [camera]);

  useEffect(() => {
    aberration.current = lens.chromatic;
    return () => {
      aberration.current = null;
      lens.pass.dispose();
    };
  }, [lens, aberration]);

  return <primitive object={lens.pass} />;
}

/**
 * The lens. Depth of field pulls focus to the node a dragged card is over and
 * narrows its range, so the target reads sharp against a softened pitch; bloom
 * turns everything the shaders push above 1.0 into light; chromatic
 * aberration flickers with drag speed and kicks hard on a drop, then decays.
 *
 * Multisampling stays off. Lines are anti-aliased analytically in the
 * shaders, and on the integrated GPU this was built on a multisampled
 * half-float target came out black through the bloom pass; without
 * multisampling the same passes render correctly.
 */
const Composer = memo(function Composer({
  quality,
  reduced,
}: {
  quality: Exclude<Quality, 'minimal'>;
  reduced: boolean;
}) {
  const composer = useRef<EffectComposerImpl>(null);
  const dof = useRef<DepthOfFieldEffect>(null);
  const aberration = useRef<ChromaticAberrationEffect | null>(null);
  const lens = useMemo(() => ({ focus: REST.clone(), want: new THREE.Vector3(), range: 70 }), []);

  /*
   * The wrapper resizes its buffers only when the canvas size changes. A
   * pixel-ratio step from the performance monitor leaves the size alone, so
   * without this the scene kept rendering at the starting resolution and the
   * step saved nothing.
   */
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  useEffect(() => {
    composer.current?.setSize(size.width, size.height);
  }, [size, dpr]);

  /* Nor does the wrapper dispose the composer: its half-float buffers would outlive a drop to the minimal tier. */
  useEffect(() => {
    const instance = composer.current;
    liveComposer.current = instance;
    return () => {
      if (liveComposer.current === instance) liveComposer.current = null;
      instance?.dispose();
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const { hoverSlot } = useBuilder.getState();
    const aiming = drag.active && hoverSlot >= 0;

    const effect = dof.current;
    if (effect?.target) {
      const node = aiming ? bridge.slotWorld[hoverSlot] : undefined;
      lens.want.copy(node ?? REST);
      lens.focus.lerp(lens.want, reduced ? 1 : 1 - Math.exp(-dt * 7));
      lens.range += ((aiming ? 26 : 70) - lens.range) * (1 - Math.exp(-dt * 4));
      effect.target.copy(lens.focus);
      effect.cocMaterial.focusRange = lens.range;
    }

    decayKick(delta);
    const speed = drag.active ? Math.min(Math.hypot(drag.vx, drag.vy) / 3, 1) : 0;
    const amount = reduced ? 0 : 0.00045 * speed + 0.0042 * Math.min(fx.kick, 1);
    aberration.current?.offset.set(amount, amount * 0.55);
  });

  const low = quality === 'low';
  return (
    <EffectComposer ref={composer} multisampling={0} stencilBuffer={false}>
      {quality === 'high' ? (
        <DepthOfField ref={dof} target={FOCUS_SEED} focusRange={70} bokehScale={2.4} resolutionScale={0.5} />
      ) : (
        <></>
      )}
      <Bloom
        mipmapBlur
        intensity={low ? 0.95 : 1.15}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.3}
        radius={0.74}
        levels={low ? 5 : 7}
      />
      {/* Low folds vignette and tone mapping into the bloom pass and drops the aberration pass entirely. */}
      {low ? <Vignette {...VIGNETTE} /> : <LensPass aberration={aberration} />}
      {low ? <ToneMapping mode={ToneMappingMode.ACES_FILMIC} /> : <></>}
    </EffectComposer>
  );
});

export function Effects({ quality, reduced }: { quality: Quality; reduced: boolean }) {
  return quality === 'minimal' ? <DirectToneMapping /> : <Composer quality={quality} reduced={reduced} />;
}
