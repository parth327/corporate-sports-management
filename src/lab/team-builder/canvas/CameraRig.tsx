import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { useBuilder } from '../store/builderStore';
import { bridge, drag, fx, ghost, type Insets } from '../store/spatialBridge';

const { ACTION } = CameraControlsImpl;

/** Everything any formation can occupy, with room for the rings: the camera always frames all of it. */
const FRAME_BOX = new THREE.Box3(new THREE.Vector3(-30, 0, -30), new THREE.Vector3(30, 7, 49));
/** Clear space kept between the framed box and the panels, in px. */
const PADDING = 20;
/** How far the camera leans toward the node being worked on, and how much it closes in. */
const GLANCE = 0.22;
const GLANCE_DOLLY = 0.93;
/** How long after a drop the camera stays on it. */
const IMPACT_HOLD = 1.1;

interface Framing {
  target: THREE.Vector3;
  distance: number;
  offset: THREE.Vector2;
  polar: number;
  azimuth: number;
}

const probe = new THREE.PerspectiveCamera();
const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
const axisX = new THREE.Vector3();
const axisY = new THREE.Vector3();
const direction = new THREE.Vector3();
const projected = new THREE.Vector3();

/**
 * Finds the distance and focal offset at which the formation box fills the
 * part of the canvas the glass panels leave clear.
 *
 * The canvas runs full-bleed under the panels, so their blur has the scene to
 * work with; centring the pitch on the canvas would put it behind the roster.
 * camera-controls' focal offset slides the camera sideways in its own plane
 * without moving the orbit centre, so the pitch sits in the clear area and
 * still orbits about its own middle. There is no closed form once perspective
 * and asymmetric insets are involved, so this iterates: project the box,
 * scale the distance by how much too big or small it came out, shift by how
 * far off centre it landed, repeat. It converges in a handful of steps and
 * runs only when the layout changes.
 *
 * The tilt is chosen too. A portrait screen is limited by the pitch's width,
 * which leaves bands of empty space above and below at an oblique angle, so
 * the camera starts at its most three-dimensional angle and tips toward
 * top-down only until the formation fills the free height.
 */
const TILTS = [0.98, 0.9, 0.82, 0.74, 0.66, 0.58, 0.5];
/** Share of the free height the formation should fill before the tilt stops steepening. */
const FILL = 0.86;

interface Solution {
  distance: number;
  fx: number;
  fy: number;
  /** Projected height over free height, at the solved distance. */
  fillY: number;
}

const solution: Solution = { distance: 0, fx: 0, fy: 0, fillY: 0 };

/** Distance and focal offset that fit the box in the free window (NDC x0, x1, y0, y1) at one tilt. */
function solveAt(polar: number, tanHalf: number, free: [number, number, number, number], target: THREE.Vector3) {
  const [x0, x1, y0, y1] = free;
  direction.setFromSphericalCoords(1, polar, 0);
  let distance = 140;
  let fx = 0;
  let fy = 0;
  let fillY = 1;
  for (let i = 0; i < 16; i += 1) {
    probe.position.copy(target).addScaledVector(direction, distance);
    probe.lookAt(target);
    probe.updateMatrixWorld();
    axisX.setFromMatrixColumn(probe.matrixWorld, 0);
    axisY.setFromMatrixColumn(probe.matrixWorld, 1);
    /* camera-controls applies the vertical offset downward, hence the minus. */
    probe.position.addScaledVector(axisX, fx).addScaledVector(axisY, -fy);
    probe.updateMatrixWorld();

    let bx0 = Infinity;
    let bx1 = -Infinity;
    let by0 = Infinity;
    let by1 = -Infinity;
    for (const corner of corners) {
      projected.copy(corner).project(probe);
      bx0 = Math.min(bx0, projected.x);
      bx1 = Math.max(bx1, projected.x);
      by0 = Math.min(by0, projected.y);
      by1 = Math.max(by1, projected.y);
    }

    const sx = (bx1 - bx0) / (x1 - x0);
    const sy = (by1 - by0) / (y1 - y0);
    const scale = Math.max(sx, sy);
    fillY = sy / scale;
    const cx = (bx0 + bx1) / 2 - (x0 + x1) / 2;
    const cy = (by0 + by1) / 2 - (y0 + y1) / 2;
    fx += cx * distance * tanHalf * probe.aspect;
    fy -= cy * distance * tanHalf;
    distance *= scale;
    fx *= scale;
    fy *= scale;
    if (Math.abs(scale - 1) < 0.001 && Math.abs(cx) < 0.001 && Math.abs(cy) < 0.001) break;
  }
  solution.distance = distance;
  solution.fx = fx;
  solution.fy = fy;
  solution.fillY = fillY;
  return solution;
}

function solveFraming(fov: number, width: number, height: number, insets: Insets, out: Framing): void {
  let x0 = -1 + (2 * (insets.left + PADDING)) / width;
  let x1 = 1 - (2 * (insets.right + PADDING)) / width;
  let y0 = -1 + (2 * (insets.bottom + PADDING)) / height;
  let y1 = 1 - (2 * (insets.top + PADDING)) / height;
  /* Panels covering nearly everything: frame against the whole canvas rather than a sliver. */
  if (x1 - x0 < 0.3) [x0, x1] = [-0.9, 0.9];
  if (y1 - y0 < 0.3) [y0, y1] = [-0.9, 0.9];

  const center = FRAME_BOX.getCenter(projected);
  out.target.set(center.x, 0, center.z);
  out.azimuth = 0;
  const { min, max } = FRAME_BOX;
  corners.forEach((corner, i) => corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));

  probe.fov = fov;
  probe.aspect = width / height;
  probe.near = 1;
  probe.far = 4000;
  probe.updateProjectionMatrix();
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov) / 2);

  for (const polar of TILTS) {
    const s = solveAt(polar, tanHalf, [x0, x1, y0, y1], out.target);
    out.polar = polar;
    out.distance = s.distance;
    out.offset.set(s.fx, s.fy);
    if (s.fillY >= FILL) break;
  }
}

/**
 * drei's CameraControls, driven rather than just enabled.
 *
 * The visitor can orbit and dolly within limits. On top of that the rig
 * frames the formation in the clear part of the screen, re-solving whenever
 * the canvas or the panels change size; leans and closes in a little toward
 * whichever node a dragged card is aiming at; holds on a drop for a moment;
 * then eases back to the distance the visitor had chosen. It only issues a
 * new move when what it wants changes, and keeps the visitor's orbit through a
 * resize unless the new framing needs a different tilt.
 */
export function CameraRig({ reduced }: { reduced: boolean }) {
  const controls = useRef<CameraControlsImpl>(null);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;

  const home = useMemo<Framing>(
    () => ({ target: new THREE.Vector3(), distance: 140, offset: new THREE.Vector2(), polar: 0.98, azimuth: 0 }),
    [],
  );
  /* `resume`: the distance the visitor had before a glance, so glances neither compound nor undo their dolly. */
  const rig = useMemo(
    () => ({ layout: '', focus: '', introAt: -1, polar: -1, resume: -1, want: new THREE.Vector3() }),
    [],
  );

  useEffect(() => {
    const c = controls.current;
    if (!c) return undefined;
    c.mouseButtons.left = ACTION.ROTATE;
    c.mouseButtons.middle = ACTION.DOLLY;
    c.mouseButtons.right = ACTION.NONE;
    c.mouseButtons.wheel = ACTION.DOLLY;
    c.touches.one = ACTION.TOUCH_ROTATE;
    c.touches.two = ACTION.TOUCH_DOLLY;
    c.touches.three = ACTION.NONE;
    c.dollyToCursor = false;
    c.azimuthRotateSpeed = 0.45;
    c.polarRotateSpeed = 0.45;
    c.dollySpeed = 0.5;
    c.draggingSmoothTime = 0.14;

    const recentre = () => {
      c.smoothTime = 0.6;
      void c.rotateTo(home.azimuth, home.polar, !bridge.reducedMotion);
      void c.dollyTo(home.distance, !bridge.reducedMotion);
      void c.moveTo(home.target.x, home.target.y, home.target.z, !bridge.reducedMotion);
      rig.focus = 'home';
      rig.resume = -1;
    };
    bridge.recentre = recentre;
    gl.domElement.addEventListener('dblclick', recentre);
    return () => {
      gl.domElement.removeEventListener('dblclick', recentre);
      if (bridge.recentre === recentre) bridge.recentre = null;
    };
  }, [gl, home, rig]);

  useFrame((state) => {
    const c = controls.current;
    if (!c) return;
    const now = state.clock.elapsedTime;

    /* 1. Re-solve the framing whenever the canvas or the panels change. */
    const { insets } = bridge;
    const layout = `${size.width}x${size.height}|${insets.top}|${insets.right}|${insets.bottom}|${insets.left}`;
    if (layout !== rig.layout) {
      const first = rig.layout === '';
      rig.layout = layout;
      solveFraming(camera.fov, size.width, size.height, insets, home);
      c.minDistance = home.distance * 0.6;
      c.maxDistance = home.distance * 1.35;
      c.minPolarAngle = Math.max(0.3, home.polar - 0.35);
      c.maxPolarAngle = Math.min(1.3, home.polar + 0.22);
      c.minAzimuthAngle = -0.65;
      c.maxAzimuthAngle = 0.65;
      void c.setFocalOffset(home.offset.x, home.offset.y, 0, !first && !reduced);
      void c.moveTo(home.target.x, home.target.y, home.target.z, !first && !reduced);

      if (first && !reduced) {
        /* Arrive: start high and off to one side, then settle into the framed view. */
        void c.rotateTo(0.5, c.minPolarAngle, false);
        void c.dollyTo(home.distance * 1.3, false);
        c.smoothTime = 1.1;
        rig.introAt = now;
        void c.rotateTo(home.azimuth, home.polar, true);
        void c.dollyTo(home.distance, true);
      } else {
        /* Keep the visitor's orbit through a resize unless the framing needs a different tilt. */
        if (first || home.polar !== rig.polar) void c.rotateTo(home.azimuth, home.polar, !first && !reduced);
        void c.dollyTo(home.distance, !first && !reduced);
      }
      rig.polar = home.polar;
      rig.focus = 'home';
      rig.resume = -1;
    }
    if (rig.introAt >= 0 && now - rig.introAt > 2.4) {
      c.smoothTime = 0.55;
      rig.introAt = -1;
    }

    /* 2. Frame the interaction: the node being aimed at, then the one just dropped on. */
    const { hoverSlot } = useBuilder.getState();
    const latest = fx.impacts[(fx.cursor + fx.impacts.length - 1) % fx.impacts.length];
    let focus = 'home';
    let slot = -1;
    if (drag.active && hoverSlot >= 0) {
      focus = `aim:${hoverSlot}`;
      slot = hoverSlot;
    } else if (ghost.phase === 'snap' && ghost.impact) {
      /* Same key as aiming at it, so releasing over a node does not restart the move. */
      focus = `aim:${ghost.slot}`;
      slot = ghost.slot;
    } else if (latest && fx.lastSlot >= 0 && bridge.time >= latest.time && bridge.time - latest.time < IMPACT_HOLD) {
      focus = `drop:${fx.lastSlot}:${latest.time.toFixed(2)}`;
      slot = fx.lastSlot;
    }
    if (focus === rig.focus || reduced) return;
    rig.focus = focus;

    const node = slot >= 0 ? bridge.slotWorld[slot] : undefined;
    if (node) {
      if (rig.resume < 0) rig.resume = c.distance;
      rig.want.set(node.x, 0, node.z).sub(home.target).multiplyScalar(GLANCE).add(home.target);
      void c.moveTo(rig.want.x, rig.want.y, rig.want.z, true);
      void c.dollyTo(Math.max(c.minDistance, Math.min(rig.resume, home.distance) * GLANCE_DOLLY), true);
    } else {
      void c.moveTo(home.target.x, home.target.y, home.target.z, true);
      void c.dollyTo(rig.resume > 0 ? rig.resume : c.distance, true);
      rig.resume = -1;
    }
  }, -2);

  return <CameraControls ref={controls} />;
}
