import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { pointerSignal } from '@/lib/signals.js';
import { narrative } from '@/lib/narrative';
import { SHOTS } from './choreography';
import type { RigState } from './Stadium';

const UP = new THREE.Vector3(0, 1, 0);

/** Seconds for the camera to close ~63% of the gap to where the scroll says it should be. */
const FOLLOW = 0.42;
const POINTER_FOLLOW = 0.75;
const INTRO_SECONDS = 3.2;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const damp = (current: number, target: number, tau: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-dt / tau));

/**
 * Flies the camera along the page's shot list.
 *
 * Damping is applied to the shot parameter, not the position, so the camera
 * always stays on the spline between two shots instead of cutting corners
 * through the stands. Everything is frame-rate independent.
 */
export function CameraRig({
  rig,
  reduced,
  pointer,
}: {
  rig: RigState;
  reduced: boolean;
  pointer: boolean;
}) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const path = useMemo(
    () => ({
      position: new THREE.CatmullRomCurve3(
        SHOTS.map((s) => new THREE.Vector3(...s.position)),
        false,
        'centripetal',
      ),
      target: new THREE.CatmullRomCurve3(
        SHOTS.map((s) => new THREE.Vector3(...s.target)),
        false,
        'centripetal',
      ),
    }),
    [],
  );

  const scratch = useMemo(
    () => ({
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      px: 0,
      py: 0,
      elapsed: 0,
      started: false,
      fov: 0,
      offset: Number.NaN,
      width: 0,
      height: 0,
    }),
    [],
  );

  /* With frameloop="demand" nothing renders on its own, so scrolling has to ask for frames. */
  useEffect(() => {
    if (!reduced) return undefined;
    const onScroll = () => invalidate();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced, invalidate]);

  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    /* Scene-only draw stats: with the composer running, gl.info otherwise reports its last full-screen pass. */
    const stats = () => {
      gl.info.autoReset = false;
      gl.info.reset();
      gl.render(scene, camera);
      const { calls, triangles, points } = gl.info.render;
      gl.info.autoReset = true;
      return { calls, triangles, points };
    };
    const hook = { camera, gl, rig, narrative, scene, stats };
    (window as unknown as { __stadium?: typeof hook }).__stadium = hook;
    return () => {
      delete (window as unknown as { __stadium?: typeof hook }).__stadium;
    };
  }, [camera, gl, rig, scene]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const last = SHOTS.length - 1;

    if (!scratch.started || reduced) {
      rig.progress = narrative.progress;
      scratch.started = true;
    } else {
      rig.progress = damp(rig.progress, narrative.progress, FOLLOW, dt);
    }
    const progress = Math.min(Math.max(rig.progress, 0), last);

    path.position.getPoint(progress / last, scratch.position);
    path.target.getPoint(progress / last, scratch.target);

    const i = Math.min(Math.floor(progress), last);
    const f = progress - i;
    const a = SHOTS[i]!;
    const b = SHOTS[Math.min(i + 1, last)]!;
    let fov = a.fov + (b.fov - a.fov) * f;

    const { width, height } = state.size;
    const aspect = width / Math.max(height, 1);
    const interior = (a.interior ? 1 : 0) + ((b.interior ? 1 : 0) - (a.interior ? 1 : 0)) * f;

    /* Shots are composed for a landscape frame. Portrait screens pull back from aerial shots, but
       widen the lens on interior ones — pulling back there would put the camera inside a stand. */
    if (aspect < 1.35) {
      const pull = Math.min(1.35 / aspect, 2.3) - 1;
      scratch.position
        .sub(scratch.target)
        .multiplyScalar(1 + pull * 0.4 * (1 - interior))
        .add(scratch.target);
      fov = Math.min(fov * (1 + pull * (0.18 + 0.3 * interior)), 78);
    }

    if (!reduced) {
      scratch.elapsed += dt;
      if (scratch.elapsed < INTRO_SECONDS) {
        const e = (1 - easeOutCubic(scratch.elapsed / INTRO_SECONDS)) * (1 - interior);
        scratch.position.sub(scratch.target).multiplyScalar(1 + e * 0.5).add(scratch.target);
        scratch.position.y += e * 36;
      }
    }

    if (pointer && !reduced) {
      scratch.px = damp(scratch.px, pointerSignal.x, POINTER_FOLLOW, dt);
      scratch.py = damp(scratch.py, pointerSignal.y, POINTER_FOLLOW, dt);
      scratch.forward.subVectors(scratch.target, scratch.position).normalize();
      scratch.right.crossVectors(scratch.forward, UP).normalize();
      scratch.up.crossVectors(scratch.right, scratch.forward).normalize();
      const reach = scratch.position.distanceTo(scratch.target) * 0.035;
      const t = state.clock.elapsedTime;
      scratch.position
        .addScaledVector(scratch.right, (scratch.px + Math.sin(t * 0.13) * 0.25) * reach)
        .addScaledVector(scratch.up, (scratch.py * 0.6 + Math.sin(t * 0.09) * 0.15) * reach);
      scratch.target.addScaledVector(scratch.right, scratch.px * reach * 0.3);
    }

    scratch.position.y = Math.max(scratch.position.y, 1.2);
    camera.position.copy(scratch.position);
    camera.lookAt(scratch.target);

    /* On wide screens the opening shot sits right of the headline; it recentres as the story moves on. */
    const offset = aspect > 1.1 ? -width * 0.17 * Math.max(0, 1 - progress) : 0;
    if (
      fov !== scratch.fov ||
      offset !== scratch.offset ||
      width !== scratch.width ||
      height !== scratch.height
    ) {
      camera.fov = fov;
      if (Math.abs(offset) > 0.5) camera.setViewOffset(width, height, offset, 0, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      scratch.fov = fov;
      scratch.offset = offset;
      scratch.width = width;
      scratch.height = height;
    }
  }, -1);

  return null;
}
