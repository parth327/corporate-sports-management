import { useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { projectToScreen } from '../hooks/useSpatial';
import { tick } from '../interaction/dragController';
import { bridge } from '../store/spatialBridge';

/**
 * The frame loop's hand-off to the DOM.
 *
 * Runs after the camera controls (-1) and the nodes (-0.5) have moved, and
 * before the composer draws (1): projects every node to client pixels, moves
 * each DOM anchor onto its node with a compositor-only transform, then steps
 * the drag controller so the ghost chases positions from this very frame.
 */
export function Projector() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;

  useLayoutEffect(() => {
    bridge.camera = camera;
    return () => {
      if (bridge.camera === camera) bridge.camera = null;
    };
  }, [camera]);

  useFrame((state) => {
    bridge.time = state.clock.elapsedTime;
    camera.updateMatrixWorld();

    bridge.slotWorld.forEach((world, i) => {
      const screen = bridge.slotScreen[i]!;
      projectToScreen(world, screen);
      const el = bridge.anchors.get(i);
      if (!el) return;
      el.style.transform = `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0)`;
      /* Nearer nodes sit lower on screen; stack their chips on top. Written only on change. */
      const visibility = screen.visible ? 'visible' : 'hidden';
      const z = String(Math.round(screen.y));
      if (el.style.visibility !== visibility) el.style.visibility = visibility;
      if (el.style.zIndex !== z) el.style.zIndex = z;
    });

    tick(performance.now());
  });

  return null;
}
