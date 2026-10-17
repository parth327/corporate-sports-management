import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import clsx from 'clsx';
import type { Sport, StadiumSlot } from './stadiumLayout';

/**
 * The squad builder's stadium.
 *
 * The slots are drei `<Html>` chips anchored to real 3D points rather than
 * meshes. That is a deliberate trade: a chip is a DOM node, so it can be
 * hit-tested with `getBoundingClientRect` exactly like every other drop zone
 * in this app, it can hold a focusable button for the keyboard path, and it
 * renders the participant's name crisply at any camera angle. Raycasting onto
 * meshes would have bought a purer 3D gesture and cost all three.
 *
 * The scene itself is genuinely 3D — ground, mown stripes, stands and pylons
 * — and the camera orbits, so a chip's position on the pitch means something.
 *
 * The pure layout maths lives in stadiumLayout.ts, deliberately: importing it
 * from here would pull three.js into the page chunk and defeat the lazy load.
 */

/* ------------------------------------------------------------------ *
 * Scenery
 * ------------------------------------------------------------------ */

/** Mown stripes, drawn once into a canvas rather than shaded per-frame. */
function useTurf(sport: Sport) {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = sport === 'generic' ? '#2c5c3a' : '#2f6b40';
    ctx.fillRect(0, 0, size, size);

    const bands = 10;
    for (let i = 0; i < bands; i += 1) {
      if (i % 2 === 0) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(0, (i * size) / bands, size, size / bands);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    return texture;
  }, [sport]);

  /* A texture handed to a material as a prop is not disposed by R3F, so each sport change leaked one on the GPU. */
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Pitch({ sport }: { sport: Sport }) {
  const turf = useTurf(sport);

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        {sport === 'cricket' ? (
          <circleGeometry args={[21, 64]} />
        ) : (
          <planeGeometry args={[30, 42]} />
        )}
        <meshStandardMaterial map={turf} roughness={0.95} metalness={0} />
      </mesh>

      {/* Markings */}
      {sport === 'cricket' && (
        <>
          {/* The strip */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[3.2, 20]} />
            <meshStandardMaterial color="#c9b78a" roughness={1} />
          </mesh>
          {/* Inner ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[13.4, 13.6, 64]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
          </mesh>
          {/* Creases */}
          {[8.5, -8.5].map((z) => (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, z]}>
              <planeGeometry args={[3.6, 0.14]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
          ))}
        </>
      )}

      {sport !== 'cricket' && (
        <>
          {/* Touchlines */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[3.9, 4.1, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <planeGeometry args={[29, 0.16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
          </mesh>
          {/* Goal boxes */}
          {[19.5, -19.5].map((z) => (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]}>
              <planeGeometry args={[12, 0.16]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

/** A low ring of stands, just enough to read as an arena rather than a lawn. */
function Stands({ sport }: { sport: Sport }) {
  const radius = sport === 'cricket' ? 24 : 26;
  const segments = 40;

  const blocks = useMemo(
    () =>
      Array.from({ length: segments }, (_, i) => {
        const angle = (i / segments) * Math.PI * 2;
        return {
          position: [Math.cos(angle) * radius, 1.1, Math.sin(angle) * radius] as [
            number,
            number,
            number,
          ],
          rotation: [0, -angle, 0] as [number, number, number],
        };
      }),
    [radius],
  );

  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.position} rotation={b.rotation}>
          <boxGeometry args={[3.6, 2.2, 3]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#2d2a3c' : '#232130'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Pylons({ sport }: { sport: Sport }) {
  const r = sport === 'cricket' ? 22 : 24;
  const spots: [number, number][] = [
    [r, r],
    [-r, r],
    [r, -r],
    [-r, -r],
  ];

  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x * 0.72, 0, z * 0.72]}>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 10, 8]} />
            <meshStandardMaterial color="#4a4559" roughness={0.8} />
          </mesh>
          <mesh position={[0, 10.3, 0]}>
            <boxGeometry args={[2.4, 1.4, 0.3]} />
            <meshBasicMaterial color="#fff4ea" toneMapped={false} />
          </mesh>
          <pointLight position={[0, 10, 0]} intensity={38} distance={46} decay={2} color="#ffe9c8" />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Slots
 * ------------------------------------------------------------------ */

function SlotChip({
  slot,
  isOver,
  canEdit,
  selectedCount,
  registerZone,
  onPickUp,
  onPlaceSelected,
  onClear,
}: {
  slot: StadiumSlot;
  isOver: boolean;
  canEdit: boolean;
  selectedCount: number;
  registerZone: (key: string) => (el: HTMLElement | null) => void;
  onPickUp: (event: React.PointerEvent<HTMLElement>, slot: StadiumSlot) => void;
  onPlaceSelected: (slot: StadiumSlot) => void;
  onClear: (slot: StadiumSlot) => void;
}) {
  const filled = Boolean(slot.occupant);

  return (
    <Html position={slot.position} center distanceFactor={undefined} zIndexRange={[20, 0]}>
      <div
        ref={registerZone(slot.key)}
        className={clsx(
          'w-[96px] select-none rounded-lg border px-1.5 py-1 text-center shadow-lg backdrop-blur-sm transition-colors',
          isOver
            ? 'border-solar-400 bg-solar-500/85 text-ink-900'
            : filled
              ? 'border-white/25 bg-ink-900/85 text-white'
              : 'border-dashed border-white/35 bg-ink-900/55 text-white/60',
        )}
        onPointerDown={(event) => filled && canEdit && onPickUp(event, slot)}
        style={{ touchAction: canEdit ? 'none' : undefined, cursor: filled && canEdit ? 'grab' : 'default' }}
      >
        <span className="block truncate text-[9px] font-bold uppercase tracking-[0.06em] opacity-70">
          {slot.typeName} {slot.index + 1}
        </span>

        {filled ? (
          <>
            <span className="block truncate text-[11px] font-semibold leading-tight" title={slot.occupant!.name}>
              {slot.occupant!.name}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClear(slot);
                }}
                className="mt-0.5 text-[10px] underline decoration-dotted underline-offset-2 opacity-70 hover:opacity-100"
              >
                remove
              </button>
            )}
          </>
        ) : canEdit && selectedCount > 0 ? (
          <button
            type="button"
            onClick={() => onPlaceSelected(slot)}
            className="mt-0.5 block w-full rounded bg-white/15 px-1 py-0.5 text-[10.5px] font-semibold hover:bg-white/25"
          >
            Place here
          </button>
        ) : (
          <span className="block text-[11px] leading-tight opacity-60">Empty</span>
        )}
      </div>
    </Html>
  );
}

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

export function StadiumScene({
  sport,
  slots,
  overKey,
  canEdit,
  selectedCount,
  registerZone,
  onPickUp,
  onPlaceSelected,
  onClear,
}: {
  sport: Sport;
  slots: StadiumSlot[];
  overKey: string | null;
  canEdit: boolean;
  selectedCount: number;
  registerZone: (key: string) => (el: HTMLElement | null) => void;
  onPickUp: (event: React.PointerEvent<HTMLElement>, slot: StadiumSlot) => void;
  onPlaceSelected: (slot: StadiumSlot) => void;
  onClear: (slot: StadiumSlot) => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 26, 30], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <color attach="background" args={['#14121d']} />
      <fog attach="fog" args={['#14121d', 55, 120]} />

      <ambientLight intensity={0.5} color="#b9c6ff" />
      <directionalLight position={[12, 26, 10]} intensity={1.1} color="#fff3e2" />

      <Pitch sport={sport} />
      <Stands sport={sport} />
      <Pylons sport={sport} />

      {slots.map((slot) => (
        <SlotChip
          key={slot.key}
          slot={slot}
          isOver={overKey === slot.key}
          canEdit={canEdit}
          selectedCount={selectedCount}
          registerZone={registerZone}
          onPickUp={onPickUp}
          onPlaceSelected={onPlaceSelected}
          onClear={onClear}
        />
      ))}

      {/* Press empty turf to orbit; chips keep their own pointer events. */}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={22}
        maxDistance={56}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.35}
      />
    </Canvas>
  );
}
