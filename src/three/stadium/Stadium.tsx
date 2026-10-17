import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { STANDINGS } from '@/lib/site-data.js';
import { themeSignal } from '@/lib/signals.js';
import { SHOTS } from './choreography';
import {
  BOWL,
  FIELD,
  ROOF,
  TAU,
  TOWER,
  beamTargets,
  buildSeatLayout,
  ellipseX,
  ellipseZ,
  sectionsFromStandings,
  sweepProfile,
  towerPositions,
  type ProfileSegment,
} from './layout';
import {
  createBeamMaterial,
  createBoardMaterial,
  createGlowMaterial,
  createGroundMaterial,
  createLampMaterial,
  createPitchMaterial,
  createSeatMaterial,
  createSharedUniforms,
  createSkyMaterial,
  type SharedUniforms,
} from './materials';

export interface StadiumQuality {
  rowSpacing: number;
  seatSpacing: number;
  segments: number;
  flashes: number;
  beamIntensity: number;
}

/** Smoothed camera progress, written by the rig and read by the director. */
export interface RigState {
  progress: number;
}

type RGB = [number, number, number];

const linear = (hex: string, k = 1): RGB => {
  const c = new THREE.Color(hex);
  return [c.r * k, c.g * k, c.b * k];
};

const BRAND = ['#C72D86', '#2475B7', '#FFCB00', '#00A170'];

function geometryFrom(built: { positions: Float32Array; colors: Float32Array; indices: Uint32Array }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(built.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(built.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(built.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Floodlights sit on the diagonals, so stands under a tower read slightly brighter. */
const towerLight = (theta: number) => 0.86 + 0.14 * Math.cos(4 * (theta - Math.PI / 4));

/* ------------------------------------------------------------------ *
 * Structure
 * ------------------------------------------------------------------ */

function Bowl({ segments }: { segments: number }) {
  const geometry = useMemo(() => {
    const { wall, lowerTop, concourse, upperTop, crown, outer } = BOWL;
    const profile: ProfileSegment[] = [
      { from: [wall, 0], to: [wall, 1.2], shade: [linear('#141120'), linear('#1d1a2a')] },
      { from: [wall, 1.2], to: [lowerTop.d, lowerTop.h], shade: [linear('#1b1827'), linear('#2e293d')] },
      { from: [lowerTop.d, lowerTop.h], to: [concourse.d, concourse.h], shade: [linear('#100e17'), linear('#100e17')] },
      /* The concourse fascia is a lit band that rings the whole bowl. */
      { from: [concourse.d, concourse.h], to: [concourse.d, concourse.wall], shade: [linear('#c6ceff', 0.5), linear('#eef0ff', 0.78)] },
      { from: [concourse.d, concourse.wall], to: [upperTop.d, upperTop.h], shade: [linear('#1a1726'), linear('#2f2a3d')] },
      { from: [upperTop.d, upperTop.h], to: [crown.d, crown.h], shade: [linear('#0f0d16'), linear('#0f0d16')] },
      /* The facade: a lit crown ribbon and a concourse window band, so aerial shots read as architecture, not a black drum. */
      { from: [crown.d, crown.h], to: [outer, crown.h - 1], shade: [linear('#16131f'), linear('#16131f')] },
      { from: [outer, crown.h - 1], to: [outer, crown.h - 2.8], shade: [linear('#dfe4ff', 0.85), linear('#dfe4ff', 0.7)] },
      { from: [outer, crown.h - 2.8], to: [outer, concourse.wall], shade: [linear('#2b2640'), linear('#1f1b2e')] },
      { from: [outer, concourse.wall], to: [outer, concourse.h - 0.1], shade: [linear('#ffd9a0', 0.6), linear('#ffcf8a', 0.5)] },
      { from: [outer, concourse.h - 0.1], to: [outer, 0], shade: [linear('#1a1726'), linear('#0c0a12')] },
    ];
    return geometryFrom(sweepProfile(profile, segments, towerLight));
  }, [segments]);

  /* Geometry passed as a prop is not R3F's to dispose; a tier change would leak the old one. */
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} matrixAutoUpdate={false}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

function Roof({ segments }: { segments: number }) {
  const [canopy, band] = useMemo(() => {
    const { inner, outer } = ROOF;
    const canopyGeometry = geometryFrom(
      sweepProfile(
        [{ from: [inner.d, inner.h], to: [outer.d, outer.h], shade: [linear('#2a2540'), linear('#15121f')] }],
        segments,
        towerLight,
      ),
    );
    /* The leading edge is a strip of lamps; values above 1 are what the bloom pass picks up. */
    const bandGeometry = geometryFrom(
      sweepProfile(
        [{ from: [inner.d, inner.h - 0.9], to: [inner.d, inner.h], shade: [linear('#fff1d8', 1.5), linear('#fff1d8', 1.9)] }],
        segments,
        () => 1,
      ),
    );
    return [canopyGeometry, bandGeometry];
  }, [segments]);

  useEffect(
    () => () => {
      canopy.dispose();
      band.dispose();
    },
    [canopy, band],
  );

  return (
    <>
      <mesh geometry={canopy} matrixAutoUpdate={false} renderOrder={2}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh geometry={band} matrixAutoUpdate={false}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** A band of LED boards on the pitch wall, with UVs running round the bowl. */
function Boards({ shared, segments }: { shared: SharedUniforms; segments: number }) {
  const material = useMemo(() => createBoardMaterial(shared, BRAND), [shared]);
  const geometry = useMemo(() => {
    const d = BOWL.wall - 0.15;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i += 1) {
      const theta = (i / segments) * TAU;
      const x = ellipseX(theta, d);
      const z = ellipseZ(theta, d);
      positions.push(x, 0.15, z, x, 1.15, z);
      uvs.push(i / segments, 0, i / segments, 1);
    }
    for (let i = 0; i < segments; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeBoundingSphere();
    return g;
  }, [segments]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} matrixAutoUpdate={false} />;
}

/** The plaza and car parks around the bowl; without it an overhead shot looks down into empty sky. */
function Ground({ shared }: { shared: SharedUniforms }) {
  const material = useMemo(() => createGroundMaterial(shared, FIELD), [shared]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    /* A ring whose hole sits inside the bowl's footprint, so it never shares depth with the pitch. */
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} material={material}>
      <ringGeometry args={[FIELD.rz + BOWL.outer - 2, 1400, 128, 1]} />
    </mesh>
  );
}

function Pitch({ material }: { material: THREE.ShaderMaterial }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[FIELD.rx + BOWL.wall, FIELD.rz + BOWL.wall, 1]}
      material={material}
    >
      <circleGeometry args={[1, 160]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ *
 * Crowd
 * ------------------------------------------------------------------ */

function Seats({
  material,
  quality,
  sections,
  onLayout,
}: {
  material: THREE.ShaderMaterial;
  quality: StadiumQuality;
  sections: ReturnType<typeof sectionsFromStandings>;
  onLayout: (positions: Float32Array) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const layout = useMemo(
    () =>
      buildSeatLayout(
        { sections, rowSpacing: quality.rowSpacing, seatSpacing: quality.seatSpacing },
        (hex) => linear(hex),
      ),
    [sections, quality.rowSpacing, quality.seatSpacing],
  );

  const geometry = useMemo(() => {
    /* Seats grow with the spacing, so a sparser crowd on a phone still reads as a full stand. */
    const g = new THREE.BoxGeometry(quality.seatSpacing * 0.72, 0.5, quality.rowSpacing * 0.46);
    g.setAttribute('aParams', new THREE.InstancedBufferAttribute(layout.params, 4));
    return g;
  }, [layout, quality.seatSpacing, quality.rowSpacing]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    instanced.instanceMatrix.array.set(layout.matrices);
    instanced.instanceMatrix.needsUpdate = true;
    instanced.instanceColor = new THREE.InstancedBufferAttribute(layout.colors, 3);
    instanced.computeBoundingSphere();

    const positions = new Float32Array(layout.count * 3);
    for (let i = 0; i < layout.count; i += 1) {
      positions[i * 3] = layout.matrices[i * 16 + 12]!;
      positions[i * 3 + 1] = layout.matrices[i * 16 + 13]!;
      positions[i * 3 + 2] = layout.matrices[i * 16 + 14]!;
    }
    onLayout(positions);
  }, [layout, onLayout]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, layout.count]}
      matrixAutoUpdate={false}
    />
  );
}

/** Camera flashes popping in the stands. */
function Flashes({
  material,
  seats,
  count,
}: {
  material: THREE.ShaderMaterial;
  seats: Float32Array | null;
  count: number;
}) {
  const geometry = useMemo(() => {
    if (!seats || seats.length < 3) return null;
    const total = seats.length / 3;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const seat = Math.floor(((i * 7919) % total + total) % total);
      positions[i * 3] = seats[seat * 3]!;
      positions[i * 3 + 1] = seats[seat * 3 + 1]! + 0.9;
      positions[i * 3 + 2] = seats[seat * 3 + 2]!;
      seeds[i] = ((i * 0.618034) % 1 + 1) % 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    g.computeBoundingSphere();
    return g;
  }, [seats, count]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ *
 * Floodlights
 * ------------------------------------------------------------------ */

const LAMP_COLUMNS = 6;
const LAMP_ROWS = 4;

function Towers({
  shared,
  beamIntensity,
  haloMaterial,
}: {
  shared: SharedUniforms;
  beamIntensity: number;
  haloMaterial: THREE.ShaderMaterial;
}) {
  const masts = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);

  const lampMaterial = useMemo(() => createLampMaterial(shared), [shared]);
  /*
   * Built once and retuned in place. Rebuilt per intensity, it would change the
   * beams' `args`, R3F would construct a fresh InstancedMesh with identity
   * matrices, and the layout effect below (keyed on `rig`) would never place
   * them again: every beam collapsed onto the centre spot after a tier change.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const beamMaterial = useMemo(() => createBeamMaterial(shared, beamIntensity), [shared]);

  useEffect(() => {
    beamMaterial.uniforms.uIntensity!.value = beamIntensity;
  }, [beamMaterial, beamIntensity]);

  const rig = useMemo(() => {
    const towers = towerPositions();
    const targets = beamTargets();
    const helper = new THREE.Object3D();
    const lookTarget = new THREE.Vector3(0, 8, 0);

    const mastMatrices: THREE.Matrix4[] = [];
    const headMatrices: THREE.Matrix4[] = [];
    const lampMatrices: THREE.Matrix4[] = [];
    const beamMatrices: THREE.Matrix4[] = [];
    const delays: number[] = [];
    const halos: number[] = [];

    towers.forEach(([x, y, z], k) => {
      helper.position.set(x, y / 2, z);
      helper.rotation.set(0, 0, 0);
      helper.scale.set(1, y, 1);
      helper.updateMatrix();
      mastMatrices.push(helper.matrix.clone());

      helper.position.set(x, y + TOWER.headHeight / 2, z);
      helper.scale.set(1, 1, 1);
      helper.lookAt(lookTarget);
      helper.updateMatrix();
      const head = helper.matrix.clone();
      headMatrices.push(head);
      /* The halo sits just in front of the lamp face, where the light actually leaves the head. */
      const face = new THREE.Vector3(0, 0, 3).applyMatrix4(head);
      halos.push(face.x, face.y, face.z);

      for (let row = 0; row < LAMP_ROWS; row += 1) {
        for (let col = 0; col < LAMP_COLUMNS; col += 1) {
          const local = new THREE.Matrix4().makeTranslation(
            (col - (LAMP_COLUMNS - 1) / 2) * 1.85,
            (row - (LAMP_ROWS - 1) / 2) * 1.55,
            0.6,
          );
          lampMatrices.push(head.clone().multiply(local));
          /* Towers strike in turn, lamps within a tower a beat apart. */
          delays.push(0.12 + k * 0.14 + (row * LAMP_COLUMNS + col) * 0.004);
        }
      }

      const from = new THREE.Vector3(x, y + TOWER.headHeight / 2, z);
      const [tx, tz] = targets[k]!;
      const to = new THREE.Vector3(tx, 0, tz);
      const length = from.distanceTo(to);
      const direction = from.clone().sub(to).normalize();
      helper.position.copy(from).add(to).multiplyScalar(0.5);
      helper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      helper.scale.set(1, length, 1);
      helper.updateMatrix();
      beamMatrices.push(helper.matrix.clone());
    });

    return { mastMatrices, headMatrices, lampMatrices, beamMatrices, delays, halos };
  }, []);

  const lampGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.5, 1.2);
    g.setAttribute('aDelay', new THREE.InstancedBufferAttribute(new Float32Array(rig.delays), 1));
    return g;
  }, [rig]);

  const haloGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rig.halos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(rig.halos.map(() => 0), 1));
    return g;
  }, [rig]);

  useLayoutEffect(() => {
    const apply = (mesh: THREE.InstancedMesh | null, matrices: THREE.Matrix4[]) => {
      if (!mesh) return;
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    apply(masts.current, rig.mastMatrices);
    apply(heads.current, rig.headMatrices);
    apply(lamps.current, rig.lampMatrices);
    apply(beams.current, rig.beamMatrices);
  }, [rig]);

  useEffect(() => () => lampMaterial.dispose(), [lampMaterial]);
  useEffect(() => () => beamMaterial.dispose(), [beamMaterial]);
  useEffect(() => () => lampGeometry.dispose(), [lampGeometry]);
  useEffect(() => () => haloGeometry.dispose(), [haloGeometry]);

  return (
    <group>
      <instancedMesh ref={masts} args={[undefined, undefined, 4]} matrixAutoUpdate={false}>
        <cylinderGeometry args={[0.7, 1.3, 1, 8]} />
        <meshBasicMaterial color="#26222f" />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, 4]} matrixAutoUpdate={false}>
        <boxGeometry args={[TOWER.headWidth, TOWER.headHeight, 0.8]} />
        <meshBasicMaterial color="#141119" />
      </instancedMesh>
      <instancedMesh
        ref={lamps}
        args={[lampGeometry, lampMaterial, rig.lampMatrices.length]}
        matrixAutoUpdate={false}
      />
      <instancedMesh ref={beams} args={[undefined, beamMaterial, 4]} matrixAutoUpdate={false} renderOrder={3}>
        <coneGeometry args={[26, 1, 40, 1, true]} />
      </instancedMesh>
      <points geometry={haloGeometry} material={haloMaterial} frustumCulled={false} renderOrder={4} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * The whole ground, plus the director that animates it
 * ------------------------------------------------------------------ */

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

export function Stadium({
  quality,
  reduced,
  rig,
}: {
  quality: StadiumQuality;
  reduced: boolean;
  rig: RigState;
}) {
  const gl = useThree((state) => state.gl);
  const shared = useMemo(() => createSharedUniforms(), []);
  const sections = useMemo(() => sectionsFromStandings(STANDINGS), []);

  const pitchMaterial = useMemo(
    () => createPitchMaterial(shared, FIELD, beamTargets().map(([x, z]) => [x * 2.2, z * 2.2] as [number, number])),
    [shared],
  );
  const seatMaterial = useMemo(() => createSeatMaterial(shared), [shared]);
  const skyMaterial = useMemo(() => createSkyMaterial(shared), [shared]);
  const flashMaterial = useMemo(
    () => createGlowMaterial(shared, { color: '#ffffff', size: 1.4, flash: true, strength: 3 }),
    [shared],
  );
  /* With no bloom pass, the halo is the whole glow of a floodlight — hence the size. */
  const haloMaterial = useMemo(
    () => createGlowMaterial(shared, { color: '#ffe3b8', size: 68, flash: false, strength: 1.45 }),
    [shared],
  );

  /* Flashes are scattered over the real seat positions, which exist only once the seats have laid out. */
  const [seatPositions, setSeatPositions] = useState<Float32Array | null>(null);

  useEffect(
    () => () => {
      pitchMaterial.dispose();
      seatMaterial.dispose();
      skyMaterial.dispose();
      flashMaterial.dispose();
      haloMaterial.dispose();
    },
    [pitchMaterial, seatMaterial, skyMaterial, flashMaterial, haloMaterial],
  );

  const director = useRef({ elapsed: 0, clock: 0, hex: '', accent: new THREE.Color() });

  useFrame((_, delta) => {
    const d = director.current;
    const dt = Math.min(delta, 1 / 20);
    d.elapsed += dt;
    if (!reduced) d.clock += dt;

    shared.uTime.value = d.clock;
    shared.uPower.value = reduced ? 1 : easeOutCubic(Math.min(d.elapsed / 2.8, 1));

    if (themeSignal.hex !== d.hex) {
      d.hex = themeSignal.hex;
      d.accent.set(d.hex);
    }
    if (reduced) shared.uAccent.value.copy(d.accent);
    else shared.uAccent.value.lerp(d.accent, 1 - Math.exp(-dt * 1.4));

    const progress = rig.progress;
    const i = Math.min(Math.floor(progress), SHOTS.length - 1);
    const f = progress - i;
    const a = SHOTS[i]!;
    const b = SHOTS[Math.min(i + 1, SHOTS.length - 1)]!;
    const excite = a.excite + (b.excite - a.excite) * f;
    const highlight = (a.highlightLeader ? 1 : 0) + ((b.highlightLeader ? 1 : 0) - (a.highlightLeader ? 1 : 0)) * f;

    seatMaterial.uniforms.uWave!.value = 0.2 + excite * 0.8;
    seatMaterial.uniforms.uHighlight!.value = highlight;
    flashMaterial.uniforms.uRate!.value = 0.35 + excite * 1.9;
    flashMaterial.uniforms.uPixelRatio!.value = gl.getPixelRatio();
    haloMaterial.uniforms.uPixelRatio!.value = gl.getPixelRatio();
    pitchMaterial.uniforms.uSweep!.value = -90 + (((d.clock * 0.025 + progress * 0.23) % 1) + 1) % 1 * 180;
  }, -0.5);

  return (
    <>
      <mesh material={skyMaterial} frustumCulled={false} renderOrder={-1}>
        <sphereGeometry args={[1000, 32, 16]} />
      </mesh>
      <Ground shared={shared} />
      <Pitch material={pitchMaterial} />
      <Bowl segments={quality.segments} />
      <Boards shared={shared} segments={quality.segments} />
      <Seats material={seatMaterial} quality={quality} sections={sections} onLayout={setSeatPositions} />
      <Roof segments={quality.segments} />
      <Towers shared={shared} beamIntensity={quality.beamIntensity} haloMaterial={haloMaterial} />
      {!reduced && quality.flashes > 0 && (
        <Flashes material={flashMaterial} seats={seatPositions} count={quality.flashes} />
      )}
    </>
  );
}
