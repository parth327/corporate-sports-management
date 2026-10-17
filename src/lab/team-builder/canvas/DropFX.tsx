import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fx } from '../store/spatialBridge';
import { IMPACTS, burstFragment, burstVertex, dustFragment, dustVertex } from './shaders';

const PER_BURST = 160;
const DUST = 360;

/** Deterministic, so the particle field is identical on every load. */
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function burstGeometry(): THREE.BufferGeometry {
  const count = PER_BURST * IMPACTS;
  const rand = random(7);
  const burst = new Float32Array(count);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    burst[i] = Math.floor(i / PER_BURST);
    seeds[i * 4] = rand() * Math.PI * 2;
    seeds[i * 4 + 1] = 6 + rand() * 24;
    /* Most particles skim the grass; about a third are sparks thrown up out of the node. */
    seeds[i * 4 + 2] = rand() < 0.32 ? 9 + rand() * 9 : 1.5 + rand() * 4;
    seeds[i * 4 + 3] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  /* Positions are computed in the shader; the attribute only sets the vertex count. */
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aBurst', new THREE.BufferAttribute(burst, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  return geometry;
}

function dustGeometry(): THREE.BufferGeometry {
  const rand = random(19);
  const seeds = new Float32Array(DUST * 4);
  for (let i = 0; i < DUST; i += 1) {
    seeds[i * 4] = (rand() - 0.5) * 130;
    seeds[i * 4 + 1] = rand() * 34;
    seeds[i * 4 + 2] = (rand() - 0.5) * 170;
    seeds[i * 4 + 3] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  return geometry;
}

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;

/**
 * GPU particles: the burst thrown up by every drop, and dust hanging in the
 * floodlit air. Both are single draw calls simulated entirely in the vertex
 * shader, so a burst costs nothing on the CPU beyond the impact ring buffer
 * the pitch already reads.
 */
export function DropFX({ reduced }: { reduced: boolean }) {
  const gl = useThree((state) => state.gl);

  const burst = useMemo(
    () => ({
      geometry: burstGeometry(),
      material: new THREE.ShaderMaterial({
        vertexShader: burstVertex,
        fragmentShader: burstFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uOrigins: { value: Array.from({ length: IMPACTS }, () => new THREE.Vector3()) },
          uStarts: { value: new Array<number>(IMPACTS).fill(-100) },
          uStrengths: { value: new Array<number>(IMPACTS).fill(0) },
          uColors: { value: Array.from({ length: IMPACTS }, () => new THREE.Color()) },
        },
        ...additive,
      }),
    }),
    [],
  );

  const dust = useMemo(
    () => ({
      geometry: dustGeometry(),
      material: new THREE.ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uMotion: { value: 1 },
          uColor: { value: new THREE.Color('#8fc4ff').multiplyScalar(0.9) },
        },
        ...additive,
      }),
    }),
    [],
  );

  useEffect(
    () => () => {
      burst.geometry.dispose();
      burst.material.dispose();
      dust.geometry.dispose();
      dust.material.dispose();
    },
    [burst, dust],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const ratio = gl.getPixelRatio();
    const u = burst.material.uniforms;
    u.uTime!.value = time;
    u.uPixelRatio!.value = ratio;
    const origins = u.uOrigins!.value as THREE.Vector3[];
    const starts = u.uStarts!.value as number[];
    const strengths = u.uStrengths!.value as number[];
    const colors = u.uColors!.value as THREE.Color[];
    fx.impacts.forEach((entry, i) => {
      origins[i]!.set(entry.x, 0.6, entry.z);
      starts[i] = entry.time;
      /* Under reduced motion a drop still lights the pitch, but nothing flies. */
      strengths[i] = reduced ? 0 : entry.strength;
      colors[i]!.copy(entry.color);
    });

    const d = dust.material.uniforms;
    d.uTime!.value = time;
    d.uPixelRatio!.value = ratio;
    d.uMotion!.value = reduced ? 0 : 1;
  });

  return (
    <>
      <points geometry={burst.geometry} material={burst.material} frustumCulled={false} renderOrder={6} />
      <points geometry={dust.geometry} material={dust.material} frustumCulled={false} renderOrder={5} />
    </>
  );
}
