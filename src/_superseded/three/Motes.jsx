import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointMaterial, Points } from '@react-three/drei';
import * as THREE from 'three';
import { themeSignal } from '../lib/signals.js';

/**
 * Floating dust in the light beams.
 *
 * Count is handed down from the graphics tier rather than fixed, so a phone
 * draws three hundred and a workstation twelve hundred from the same code.
 */
export default function Motes({ count = 900, reduced = false }) {
  const points = useRef(null);
  const material = useRef(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = THREE.MathUtils.randFloatSpread(70);
      arr[i * 3 + 1] = THREE.MathUtils.randFloatSpread(38);
      arr[i * 3 + 2] = THREE.MathUtils.randFloat(-50, 12);
    }
    return arr;
  }, [count]);

  const tint = useMemo(() => new THREE.Color('#ffffff'), []);
  const mixed = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    if (!points.current) return;
    const d = Math.min(delta, 1 / 30);

    if (!reduced) {
      // A slow updraft plus a lazy yaw. Dust in a stadium never falls straight.
      points.current.rotation.y += d * 0.012;
      points.current.position.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.8;
    }

    if (material.current) {
      mixed.copy(tint).lerp(themeSignal.target, 0.45);
      material.current.color.lerp(mixed, d * 1.5);
    }
  });

  if (count === 0) return null;

  return (
    <Points ref={points} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        ref={material}
        transparent
        color="#f0d8ea"
        size={0.075}
        sizeAttenuation
        depthWrite={false}
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </Points>
  );
}
