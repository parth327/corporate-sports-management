import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { pointerSignal, scrollSignal } from '../lib/signals.js';

/**
 * Slow cinematic drift for the backdrop camera.
 *
 * Two inputs, both polled from module singletons rather than React state:
 * pointer position gives parallax, scroll progress walks the camera down and
 * back so the arena opens up as the page advances.
 *
 * The damping is frame-rate independent — `alpha` is derived from the actual
 * delta, so a 60Hz laptop and a 144Hz monitor settle on the same curve.
 */
export default function CameraDrift({ reduced = false }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = scrollSignal.progress;

    // Parallax is disabled under reduced-motion; the scroll response stays,
    // because that one is a direct consequence of an action the user took.
    const px = reduced ? 0 : pointerSignal.x;
    const py = reduced ? 0 : pointerSignal.y;
    const breathe = reduced ? 0 : 1;

    target.set(
      px * 1.5 + Math.sin(t * 0.18) * 0.4 * breathe,
      py * 0.8 - p * 3.2 + Math.cos(t * 0.15) * 0.3 * breathe,
      17 - p * 4
    );

    const d = Math.min(delta, 1 / 30);
    const alpha = 1 - Math.pow(0.0025, d);
    state.camera.position.lerp(target, alpha);

    lookAt.set(px * 0.6, -p * 2.4, -6);
    state.camera.lookAt(lookAt);
  });

  return null;
}
