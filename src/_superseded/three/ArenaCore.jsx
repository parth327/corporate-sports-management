import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pointerSignal, scrollSignal, themeSignal } from '../lib/signals.js';
import blobTexture from './blobTexture.js';

/**
 * The focal object: a dark faceted core inside a bright wireframe shell, ringed
 * like a mill pot. Reads as a ball, a pigment particle and a trophy base at
 * once — the overlap this company's events actually sit in.
 *
 * It is intentionally unlit. An earlier lit version turned muddy brown against
 * the dark backdrop, because a low-key ambient on a dark material produces
 * exactly that. Everything here is emissive or basic, so the bloom pass gets
 * clean, saturated input and the object never greys out.
 */
export default function ArenaCore({ compact = false, reduced = false }) {
  const group = useRef(null);
  const shell = useRef(null);
  const ringA = useRef(null);
  const ringB = useRef(null);
  const glow = useRef(null);

  /**
   * Placement is a legibility decision, not a composition one. On desktop the
   * copy occupies the left third, so the core sits right. On narrow screens the
   * copy spans the full width, so it lifts clear above the headline instead of
   * sitting behind it — a wireframe behind body text is unreadable at 390px.
   */
  const basePosition = useMemo(
    () => (compact ? new THREE.Vector3(2.4, 7.4, -13) : new THREE.Vector3(7.2, 0.4, -3)),
    [compact]
  );
  const baseScale = compact ? 2.4 : 2.7;

  const magenta = useMemo(() => new THREE.Color('#C72D86'), []);
  const mixed = useMemo(() => new THREE.Color(), []);
  const halo = blobTexture();

  useFrame((state, delta) => {
    if (!group.current) return;
    const d = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const p = scrollSignal.progress;

    // Drifts up and away as the page advances, clearing the copy below.
    group.current.position.set(
      basePosition.x + (reduced ? 0 : pointerSignal.x * 0.4),
      basePosition.y + p * 6 + (reduced ? 0 : Math.sin(t * 0.4) * 0.18),
      basePosition.z - p * 11
    );

    const spin = reduced ? 0 : 1;
    group.current.rotation.y += d * (0.1 + p * 0.25) * spin;
    group.current.rotation.x = Math.sin(t * 0.22) * 0.1 * spin;

    if (shell.current) shell.current.rotation.y -= d * 0.2 * spin;
    if (ringA.current) ringA.current.rotation.z += d * 0.3 * spin;
    if (ringB.current) ringB.current.rotation.x -= d * 0.22 * spin;

    mixed.copy(magenta).lerp(themeSignal.target, 0.45);
    if (shell.current) shell.current.material.color.lerp(mixed, d * 2);
    if (ringA.current) ringA.current.material.color.lerp(mixed, d * 2);
    if (glow.current) glow.current.material.color.lerp(mixed, d * 2);
  });

  return (
    <group ref={group} scale={baseScale}>
      {/* Soft halo so the object sits in light rather than on top of it.
          The map is not optional — an unmapped sprite draws a solid quad. */}
      <sprite ref={glow} scale={6.2}>
        <spriteMaterial
          map={halo}
          color="#C72D86"
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {/* Solid core, near-black so the wireframe reads against it. */}
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#0A0710" toneMapped={false} />
      </mesh>

      {/* Bright wireframe shell */}
      <mesh ref={shell} scale={1.14}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color="#C72D86"
          wireframe
          transparent
          opacity={0.55}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Orbit rings */}
      <mesh ref={ringA} rotation={[Math.PI / 2.3, 0, 0]} scale={1.6}>
        <torusGeometry args={[1, 0.011, 8, 128]} />
        <meshBasicMaterial color="#C72D86" transparent opacity={0.95} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} rotation={[0, 0.4, Math.PI / 3]} scale={1.95}>
        <torusGeometry args={[1, 0.007, 8, 128]} />
        <meshBasicMaterial color="#FFCB00" transparent opacity={0.7} toneMapped={false} />
      </mesh>
    </group>
  );
}
