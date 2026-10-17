import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { FORMATIONS, ROLE_COLOR, type Slot } from '../data/squad';
import { useBuilder } from '../store/builderStore';
import { bridge } from '../store/spatialBridge';
import { beamFragment, beamVertex, holoFragment, holoVertex, ringFragment, ringVertex } from './shaders';

/** Height the hologram floats at; the DOM chip is pinned to the same point. */
export const NODE_HEIGHT = 4.2;

/**
 * One set of geometry for all eleven nodes, made per mount and disposed with
 * it. At module scope it would outlive the canvas, and each renderer that ever
 * drew it would stay reachable through the geometry's dispose listeners.
 */
function createNodeGeometry() {
  return {
    ring: new THREE.RingGeometry(2.2, 3.15, 72, 1),
    crystal: new THREE.OctahedronGeometry(1.1, 0),
    core: new THREE.IcosahedronGeometry(0.3, 1),
    beam: new THREE.CylinderGeometry(0.42, 0.95, 1, 24, 1, true).translate(0, 0.5, 0),
    /* The raycast target: a generous column round the hologram, never drawn. */
    hit: new THREE.CylinderGeometry(4.4, 4.4, 9.5, 12, 1).translate(0, 4.75, 0),
  };
}

type NodeGeometry = ReturnType<typeof createNodeGeometry>;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
} as const;

interface NodeProps {
  index: number;
  slot: Slot;
  hovered: boolean;
  occupied: boolean;
  reduced: boolean;
  geometry: NodeGeometry;
}

/**
 * One formation slot as a hologram: a dashed ring on the grass, a column of
 * light, and a faceted crystal with a hot core floating over it.
 *
 * react-spring owns the physical motion — the glide to a new formation, the
 * snap outward and brighter when a dragged card's raycast lands on the node,
 * the collapse when a player takes the slot — and the frame loop layers the
 * idle breathing on top and hands the result to the shaders and the DOM.
 */
const HoloNode = memo(function HoloNode({ index, slot, hovered, occupied, reduced, geometry }: NodeProps) {
  const group = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const hit = useRef<THREE.Mesh>(null);

  const [spring, api] = useSpring(() => ({
    x: slot.x,
    z: slot.z,
    hover: 0,
    occupied: occupied ? 1 : 0,
  }));

  /* A formation change glides every node to its new spot, a beat apart, so the shape visibly re-forms. */
  useEffect(() => {
    void api.start({
      x: slot.x,
      z: slot.z,
      delay: reduced ? 0 : index * 26,
      immediate: reduced,
      config: { mass: 1.4, tension: 190, friction: 24 },
    });
  }, [api, slot.x, slot.z, index, reduced]);

  /* Under-damped on the way in, so a targeted node overshoots and settles like something with mass. */
  useEffect(() => {
    void api.start({
      hover: hovered ? 1 : 0,
      immediate: reduced,
      config: hovered ? { mass: 0.8, tension: 520, friction: 13 } : { mass: 1, tension: 280, friction: 26 },
    });
  }, [api, hovered, reduced]);

  useEffect(() => {
    void api.start({ occupied: occupied ? 1 : 0, immediate: reduced, config: { tension: 260, friction: 22 } });
  }, [api, occupied, reduced]);

  /* The live colour eases toward the role's, so a slot that changes role in a new formation fades across. */
  const target = useMemo(() => new THREE.Color(ROLE_COLOR[slot.role]), [slot.role]);
  const [color] = useState(() => target.clone());

  const materials = useMemo(() => {
    const uniforms = {
      uColor: { value: color },
      uHover: { value: 0 },
      uOccupied: { value: 0 },
      uTime: { value: 0 },
      uMotion: { value: 1 },
    };
    return {
      uniforms,
      beamLevel: { value: 0.5 },
      ring: new THREE.ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        uniforms,
        side: THREE.DoubleSide,
        ...additive,
      }),
      crystal: new THREE.ShaderMaterial({
        vertexShader: holoVertex,
        fragmentShader: holoFragment,
        uniforms,
        ...additive,
      }),
      core: new THREE.MeshBasicMaterial({ color: color.clone(), toneMapped: false, fog: false }),
    };
  }, [color]);

  const beamMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        uniforms: {
          uColor: materials.uniforms.uColor,
          uTime: materials.uniforms.uTime,
          uMotion: materials.uniforms.uMotion,
          uLevel: materials.beamLevel,
        },
        side: THREE.DoubleSide,
        ...additive,
      }),
    [materials],
  );

  useEffect(
    () => () => {
      materials.ring.dispose();
      materials.crystal.dispose();
      materials.core.dispose();
      beamMaterial.dispose();
    },
    [materials, beamMaterial],
  );

  /* The hit volume joins the raycast set for as long as the node exists. */
  useLayoutEffect(() => {
    const mesh = hit.current;
    if (!mesh) return undefined;
    mesh.userData.slot = index;
    bridge.hitTargets.push(mesh);
    return () => {
      bridge.hitTargets = bridge.hitTargets.filter((m) => m !== mesh);
    };
  }, [index]);

  useFrame((state, delta) => {
    const g = group.current;
    const c = crystal.current;
    const k = core.current;
    const r = ring.current;
    const b = beam.current;
    if (!g || !c || !k || !r || !b) return;

    const t = state.clock.elapsedTime;
    const h = spring.hover.get();
    const o = spring.occupied.get();
    const phase = index * 0.77;
    const bob = reduced ? 0 : Math.sin(t * 1.25 + phase) * 0.22;
    const breathe = reduced ? 1 : 1 + Math.sin(t * 2.0 + phase) * 0.05;
    const y = NODE_HEIGHT + bob + h * 0.55;

    g.position.set(spring.x.get(), 0, spring.z.get());

    /* A player standing here collapses the crystal; their chip takes its place at the same point. */
    const s = (1 + 0.45 * h) * breathe * (1 - o);
    c.visible = s > 0.01;
    c.position.y = y;
    c.rotation.y = reduced ? phase : t * 0.55 + phase;
    c.scale.set(s, s * 1.5, s);

    k.visible = c.visible;
    k.position.y = y;
    k.scale.setScalar((0.85 + 0.7 * h) * breathe * (1 - o));

    r.scale.setScalar(1 + 0.3 * h);
    b.scale.set(1 + 0.5 * h, y, 1 + 0.5 * h);

    color.lerp(target, reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 6));
    materials.uniforms.uHover.value = h;
    materials.uniforms.uOccupied.value = o;
    materials.uniforms.uTime.value = t;
    materials.uniforms.uMotion.value = reduced ? 0 : 1;
    materials.beamLevel.value = 0.4 + 0.9 * h + 0.35 * o;
    materials.core.color.copy(color).multiplyScalar(2.6 + 3.2 * h);

    bridge.slotWorld[index]?.set(g.position.x, y, g.position.z);
  }, -0.5);

  return (
    <group ref={group} position={[slot.x, 0, slot.z]}>
      <mesh ref={ring} geometry={geometry.ring} material={materials.ring} rotation-x={-Math.PI / 2} position-y={0.05} renderOrder={1} />
      <mesh ref={beam} geometry={geometry.beam} material={beamMaterial} renderOrder={2} />
      <mesh ref={crystal} geometry={geometry.crystal} material={materials.crystal} renderOrder={3} />
      <mesh ref={core} geometry={geometry.core} material={materials.core} renderOrder={4} />
      <mesh ref={hit} geometry={geometry.hit} visible={false} />
    </group>
  );
});

/** The eleven slots of the current formation. */
export function FormationNodes({ reduced }: { reduced: boolean }) {
  const formation = useBuilder((s) => s.formation);
  const hoverSlot = useBuilder((s) => s.hoverSlot);
  const lineup = useBuilder((s) => s.lineup);
  const flight = useBuilder((s) => s.flight);
  const dragging = useBuilder((s) => s.dragging);

  const geometry = useMemo(createNodeGeometry, []);
  useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);

  return (
    <>
      {FORMATIONS[formation].map((slot, index) => {
        const id = lineup[index];
        return (
          <HoloNode
            key={index}
            index={index}
            slot={slot}
            hovered={hoverSlot === index}
            occupied={Boolean(id) && id !== flight && id !== dragging}
            reduced={reduced}
            geometry={geometry}
          />
        );
      })}
    </>
  );
}
