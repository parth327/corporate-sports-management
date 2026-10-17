import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pointerSignal, scrollSignal } from '../lib/signals.js';
import blobTexture from './blobTexture.js';

/**
 * Pigment dispersing in dark fluid — the backdrop's main event.
 *
 * Colour is the subject of the portal, so the most on-brand
 * backdrop available is literally the product: soft blooms of colour suspended
 * in black, drifting and folding into each other.
 *
 * Implementation is deliberately cheap. Each bloom is one camera-facing quad
 * with a radial-gradient texture, drawn additively with no depth write. A dozen
 * of those cost a handful of draw calls and read as volumetric once the bloom
 * pass gets hold of them — far cheaper than any real volumetric, and far more
 * legible behind text than the lit geometry it replaces.
 */

/* Positions are hand-placed rather than random: the left third of the frame is
   kept clear on desktop because that is where the headline and body copy sit. */
const BLOOMS = [
  { pos: [7.5, 2.4, -6], scale: 15, color: '#C72D86', speed: 0.11, opacity: 0.5 },
  { pos: [12, -3.5, -14], scale: 22, color: '#2475B7', speed: 0.08, opacity: 0.42 },
  { pos: [-11, 4.5, -20], scale: 19, color: '#7A1550', speed: 0.13, opacity: 0.38 },
  { pos: [3, -7, -10], scale: 14, color: '#FFCB00', speed: 0.16, opacity: 0.2 },
  { pos: [-15, -5, -26], scale: 25, color: '#12436E', speed: 0.06, opacity: 0.45 },
  { pos: [16, 6, -30], scale: 20, color: '#00A170', speed: 0.09, opacity: 0.22 },
  { pos: [0, 9, -24], scale: 17, color: '#A01F6B', speed: 0.1, opacity: 0.3 },
  { pos: [-5, -2, -34], scale: 28, color: '#1A5B92', speed: 0.05, opacity: 0.35 },
];

function Bloom({ texture, pos, scale, color, speed, opacity, reduced }) {
  const ref = useRef(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!ref.current || reduced) return;
    const t = state.clock.elapsedTime;

    // Each bloom breathes on its own phase, so the field never pulses in unison.
    ref.current.position.x = pos[0] + Math.sin(t * speed + phase) * 2.2;
    ref.current.position.y = pos[1] + Math.cos(t * speed * 0.8 + phase) * 1.6;
    ref.current.material.rotation = t * speed * 0.4;

    const breathe = 1 + Math.sin(t * speed * 1.3 + phase) * 0.09;
    ref.current.scale.setScalar(scale * breathe);
  });

  return (
    <sprite ref={ref} position={pos} scale={scale}>
      <spriteMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}

export default function PigmentClouds({ reduced = false, count = BLOOMS.length }) {
  const texture = blobTexture();
  const group = useRef(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    const d = Math.min(delta, 1 / 30);

    // The whole field drifts with scroll and leans away from the pointer, which
    // gives the flat quads a convincing sense of depth.
    const targetY = -scrollSignal.progress * 12;
    const targetX = reduced ? 0 : -pointerSignal.x * 1.8;

    group.current.position.y += (targetY - group.current.position.y) * d * 2.5;
    group.current.position.x += (targetX - group.current.position.x) * d * 2;
    if (!reduced) group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.04) * 0.08;
  });

  return (
    <group ref={group}>
      {BLOOMS.slice(0, count).map((b, i) => (
        <Bloom key={i} texture={texture} reduced={reduced} {...b} />
      ))}
    </group>
  );
}
