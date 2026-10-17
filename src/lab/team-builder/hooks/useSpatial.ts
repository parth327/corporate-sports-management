import { useCallback, useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import { bridge, type Rect, type ScreenPoint } from '../store/spatialBridge';

/**
 * Screen <-> pitch conversions. Module-level scratch objects, because these run
 * on every pointer move and every frame and must not allocate.
 */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pitchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const scratch = new THREE.Vector3();

function toNdc(clientX: number, clientY: number): THREE.Vector2 {
  const r = bridge.rect;
  return ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
}

/** Casts a ray through a screen point onto the pitch plane (y = 0). */
export function screenToPitch(clientX: number, clientY: number, out: THREE.Vector3): boolean {
  const camera = bridge.camera;
  if (!camera) return false;
  raycaster.setFromCamera(toNdc(clientX, clientY), camera);
  return raycaster.ray.intersectPlane(pitchPlane, out) !== null;
}

const hits: THREE.Intersection[] = [];

/** The slot whose hologram hit-volume the screen point is over, found by a real raycast; -1 if none. */
export function raycastSlot(clientX: number, clientY: number): number {
  const camera = bridge.camera;
  if (!camera || bridge.hitTargets.length === 0) return -1;
  raycaster.setFromCamera(toNdc(clientX, clientY), camera);
  hits.length = 0;
  raycaster.intersectObjects(bridge.hitTargets, false, hits);
  const hit = hits[0];
  return hit ? Number(hit.object.userData.slot) : -1;
}

const nearest = { slot: -1, distance: 0 };

/** Nearest slot to a point on the pitch, measured on the ground plane. The result is reused between calls. */
export function nearestSlot(point: THREE.Vector3, maxDistance: number): { slot: number; distance: number } {
  nearest.slot = -1;
  nearest.distance = maxDistance;
  bridge.slotWorld.forEach((world, index) => {
    const d = Math.hypot(world.x - point.x, world.z - point.z);
    if (d < nearest.distance) {
      nearest.distance = d;
      nearest.slot = index;
    }
  });
  return nearest;
}

/** How far, in metres on the grass, a node's pull reaches. */
export const MAGNET_RADIUS = 10;
/** The same reach in pixels, used when there is no camera to raycast with. */
const SCREEN_RADIUS = 72;

export interface Magnet {
  slot: number;
  /** 0..1: 1 over the node's hologram, falling to 0 at the edge of its reach. */
  strength: number;
}

const groundPoint = new THREE.Vector3();

/**
 * The slot a pointer at (x, y) is drawn to, written into `out`.
 *
 * A raycast against the holograms' hit volumes wins outright: the pointer is
 * over a node as the viewer sees it, whatever the perspective. Otherwise the
 * pointer is projected onto the grass and the nearest node within reach pulls
 * with a strength that falls off with distance, which is what makes the zones
 * feel magnetic rather than like hit boxes.
 */
export function magnetAt(clientX: number, clientY: number, out: Magnet): Magnet {
  out.slot = -1;
  out.strength = 0;
  if (!bridge.camera) {
    let best = SCREEN_RADIUS;
    bridge.slotScreen.forEach((point, index) => {
      const d = Math.hypot(point.x - clientX, point.y - clientY);
      if (point.visible && d < best) {
        best = d;
        out.slot = index;
      }
    });
    if (out.slot >= 0) out.strength = 1 - best / SCREEN_RADIUS;
    return out;
  }
  const hit = raycastSlot(clientX, clientY);
  if (hit >= 0) {
    out.slot = hit;
    out.strength = 1;
    return out;
  }
  if (!screenToPitch(clientX, clientY, groundPoint)) return out;
  const { slot, distance } = nearestSlot(groundPoint, MAGNET_RADIUS);
  if (slot >= 0) {
    out.slot = slot;
    out.strength = 1 - distance / MAGNET_RADIUS;
  }
  return out;
}

/** World position to client coordinates; `visible` is false behind the camera or outside the depth range. */
export function projectToScreen(world: THREE.Vector3, out: ScreenPoint): ScreenPoint {
  const camera = bridge.camera;
  if (!camera) {
    out.visible = false;
    return out;
  }
  scratch.copy(world).project(camera);
  const r = bridge.rect;
  out.x = r.left + ((scratch.x + 1) / 2) * r.width;
  out.y = r.top + ((1 - scratch.y) / 2) * r.height;
  out.visible = scratch.z > -1 && scratch.z < 1;
  return out;
}

/** Ref callback that pins an element to a slot's projected position; the canvas moves it every frame. */
export function useSlotAnchor(slot: number) {
  return useCallback(
    (el: HTMLElement | null) => {
      if (el) bridge.anchors.set(slot, el);
      else bridge.anchors.delete(slot);
    },
    [slot],
  );
}

/**
 * Keeps a rect in the bridge in step with an element's box (the canvas, the
 * roster panel). `key` re-attaches when the ref comes to point at another element.
 */
export function useTrackedRect(ref: RefObject<HTMLElement>, target: Rect, key?: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      target.left = r.left;
      target.top = r.top;
      target.width = Math.max(r.width, 1);
      target.height = Math.max(r.height, 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref, target, key]);
}
