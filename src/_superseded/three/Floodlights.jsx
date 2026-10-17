import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { themeSignal } from '../lib/signals.js';
import blobTexture from './blobTexture.js';

/**
 * Distant floodlights on the horizon.
 *
 * An earlier version modelled full pylons with masts and volumetric beam cones.
 * It read as grey geometry smeared across the copy rather than as light — at
 * this camera distance the structure is never legible, only the glow is. So the
 * structure is gone: what remains is the emissive lamp array itself, placed far
 * back and left to the bloom pass, which is the only part that was ever doing
 * the work.
 *
 * The emissive colour lerps toward whatever accent the section in view
 * published, so the arena lighting shifts as you read down the page.
 */
function LampArray({ position, scale = 1, materialRef, haloRef, lightRef }) {
  const halo = blobTexture();

  const panels = useMemo(() => {
    const out = [];
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        out.push([(col - 1.5) * 0.78, row * 0.72, 0]);
      }
    }
    return out;
  }, []);

  return (
    <group position={position} scale={scale}>
      {/* The halo is what actually reads as a floodlight. Bare emissive planes
          look like white blocks at this distance; the soft bloom around them is
          what the eye interprets as a light source. */}
      <sprite ref={haloRef} position={[0, 0.36, 0.2]} scale={9}>
        <spriteMaterial
          map={halo}
          color="#ffdca0"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {panels.map((p, i) => (
        <mesh key={i} position={p}>
          <planeGeometry args={[0.62, 0.54]} />
          <meshBasicMaterial
            ref={i === 0 ? materialRef : undefined}
            color="#fff4ea"
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}

      <pointLight ref={lightRef} intensity={26} distance={70} decay={2} color="#ffdca0" />
    </group>
  );
}

export default function Floodlights({ reduced = false }) {
  const group = useRef(null);
  const materialRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const haloRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const lightRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Warm tungsten base the section accent is mixed into, so the lamps keep
  // their stadium character even when the accent is a cold blue.
  const warm = useMemo(() => new THREE.Color('#fff0d6'), []);
  const mixed = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const d = Math.min(delta, 1 / 30);
    mixed.copy(warm).lerp(themeSignal.target, 0.4);

    materialRefs.forEach((r) => r.current && r.current.color.lerp(mixed, d * 2));
    haloRefs.forEach((r) => r.current && r.current.material.color.lerp(mixed, d * 2));
    lightRefs.forEach((r) => r.current && r.current.color.lerp(mixed, d * 2));

    if (group.current && !reduced) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.02;
    }
  });

  return (
    <group ref={group}>
      {/* The near pair is pushed wide and high deliberately: at the original
          spacing they sat directly behind the hero headline, and small bright
          blocks behind large type read as dirt on the screen. */}
      <LampArray position={[-38, 18, -52]} scale={1.1} materialRef={materialRefs[0]} haloRef={haloRefs[0]} lightRef={lightRefs[0]} />
      <LampArray position={[38, 18, -52]} scale={1.1} materialRef={materialRefs[1]} haloRef={haloRefs[1]} lightRef={lightRefs[1]} />
      <LampArray position={[-44, 16, -74]} scale={1.5} materialRef={materialRefs[2]} haloRef={haloRefs[2]} lightRef={lightRefs[2]} />
      <LampArray position={[44, 16, -74]} scale={1.5} materialRef={materialRefs[3]} haloRef={haloRefs[3]} lightRef={lightRefs[3]} />
    </group>
  );
}
