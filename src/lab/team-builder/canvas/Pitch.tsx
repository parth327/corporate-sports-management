import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FORMATIONS, PLAYER_BY_ID, ROLE_COLOR, fit, type Role } from '../data/squad';
import { useBuilder } from '../store/builderStore';
import { bridge, drag, fx } from '../store/spatialBridge';
import { IMPACTS, SLOTS, pitchFragment, pitchVertex } from './shaders';

/** Half extents of a regulation 68 × 105 m field. */
export const FIELD_HALF = { x: 34, z: 52.5 } as const;

const ROLE_LINEAR = Object.fromEntries(
  Object.entries(ROLE_COLOR).map(([role, hex]) => [role, new THREE.Color(hex)]),
) as Record<Role, THREE.Color>;

/**
 * The pitch and the arena floor around it, as a single shader-driven plane.
 *
 * Everything that moves on it is a uniform: the pads under the formation
 * slots (targeted, occupied, and tinted by how well the player in hand suits
 * each one), the band of light along the line being targeted, and the ring of
 * the last few drops. The plane itself never changes, so a drop costs a few
 * uniform writes and nothing else.
 */
export function Pitch({ reduced }: { reduced: boolean }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pitchVertex,
        fragmentShader: pitchFragment,
        fog: true,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: { value: 0 },
          uMotion: { value: 1 },
          uHalf: { value: new THREE.Vector2(FIELD_HALF.x, FIELD_HALF.z) },
          uSlots: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
          uSlotColors: { value: Array.from({ length: SLOTS }, () => new THREE.Color()) },
          uImpacts: { value: Array.from({ length: IMPACTS }, () => new THREE.Vector4(0, 0, -100, 0)) },
          uImpactColors: { value: Array.from({ length: IMPACTS }, () => new THREE.Color()) },
          uGridColor: { value: new THREE.Color('#2f86e8') },
          uLineColor: { value: new THREE.Color('#d9ecff') },
          uGlassColor: { value: new THREE.Color('#0b1a36') },
          uFocusZ: { value: 0 },
          uFocus: { value: 0 },
        },
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  /* Per-slot values eased toward their targets, so pads fade rather than blink. */
  const eased = useMemo(
    () => ({
      targeted: new Float32Array(SLOTS),
      occupied: new Float32Array(SLOTS),
      suit: new Float32Array(SLOTS).fill(1),
      focusZ: 0,
      focus: 0,
    }),
    [],
  );

  useFrame((state, delta) => {
    const u = material.uniforms;
    const dt = Math.min(delta, 1 / 20);
    const k = reduced ? 1 : 1 - Math.exp(-dt * 10);
    u.uTime!.value = state.clock.elapsedTime;
    u.uMotion!.value = reduced ? 0 : 1;

    const { formation, lineup, hoverSlot, dragging, selected, flight } = useBuilder.getState();
    const slots = FORMATIONS[formation];
    const inHand = PLAYER_BY_ID.get(dragging ?? selected ?? '');
    const pads = u.uSlots!.value as THREE.Vector4[];
    const colors = u.uSlotColors!.value as THREE.Color[];

    for (let i = 0; i < SLOTS; i += 1) {
      const slot = slots[i];
      const world = bridge.slotWorld[i];
      if (!slot || !world) continue;
      const id = lineup[i];
      const occupied = id && id !== flight && id !== dragging ? 1 : 0;
      /* With a player in hand, the slots they suit glow and the rest recede. */
      const f = inHand ? fit(inHand, slot) : 1;
      const suit = inHand ? 0.55 + 1.6 * f * f : 1;
      eased.targeted[i]! += ((hoverSlot === i ? 1 : 0) - eased.targeted[i]!) * k;
      eased.occupied[i]! += (occupied - eased.occupied[i]!) * k;
      eased.suit[i]! += (suit - eased.suit[i]!) * k;
      pads[i]!.set(world.x, world.z, eased.targeted[i]!, eased.occupied[i]!);
      colors[i]!.copy(ROLE_LINEAR[slot.role]).multiplyScalar(eased.suit[i]!);
    }

    const impacts = u.uImpacts!.value as THREE.Vector4[];
    const impactColors = u.uImpactColors!.value as THREE.Color[];
    fx.impacts.forEach((entry, i) => {
      impacts[i]!.set(entry.x, entry.z, entry.time, entry.strength);
      impactColors[i]!.copy(entry.color);
    });

    const target = drag.active && hoverSlot >= 0 ? bridge.slotWorld[hoverSlot] : undefined;
    if (target) eased.focusZ += (target.z - eased.focusZ) * (reduced ? 1 : 1 - Math.exp(-dt * 12));
    eased.focus += ((target ? 1 : 0) - eased.focus) * k;
    u.uFocusZ!.value = eased.focusZ;
    u.uFocus!.value = eased.focus;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} material={material} renderOrder={-1}>
      <planeGeometry args={[900, 900, 1, 1]} />
    </mesh>
  );
}
