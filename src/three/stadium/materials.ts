import * as THREE from 'three';
import {
  beamFragment,
  beamVertex,
  boardFragment,
  boardVertex,
  glowFragment,
  glowVertex,
  groundFragment,
  groundVertex,
  lampFragment,
  lampVertex,
  pitchFragment,
  pitchVertex,
  seatFragment,
  seatVertex,
  skyFragment,
  skyVertex,
} from './shaders';

/** Uniforms every stadium material reads, shared by reference so one write per frame reaches them all. */
export interface SharedUniforms {
  uTime: THREE.IUniform<number>;
  uPower: THREE.IUniform<number>;
  uAccent: THREE.IUniform<THREE.Color>;
}

export function createSharedUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uPower: { value: 0 },
    uAccent: { value: new THREE.Color('#2475B7') },
  };
}

function fogged(uniforms: Record<string, THREE.IUniform>) {
  return { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...uniforms };
}

export function createPitchMaterial(
  shared: SharedUniforms,
  field: { rx: number; rz: number },
  pools: [number, number][],
) {
  return new THREE.ShaderMaterial({
    vertexShader: pitchVertex,
    fragmentShader: pitchFragment,
    fog: true,
    uniforms: fogged({
      uTime: shared.uTime,
      uPower: shared.uPower,
      uAccent: shared.uAccent,
      uSweep: { value: -60 },
      uField: { value: new THREE.Vector2(field.rx, field.rz) },
      uPools: { value: pools.map(([x, z]) => new THREE.Vector2(x, z)) },
    }),
  });
}

export function createGroundMaterial(shared: SharedUniforms, field: { rx: number; rz: number }) {
  return new THREE.ShaderMaterial({
    vertexShader: groundVertex,
    fragmentShader: groundFragment,
    fog: true,
    uniforms: fogged({
      uPower: shared.uPower,
      uAccent: shared.uAccent,
      uField: { value: new THREE.Vector2(field.rx, field.rz) },
    }),
  });
}

export function createSeatMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: seatVertex,
    fragmentShader: seatFragment,
    fog: true,
    uniforms: fogged({
      uTime: shared.uTime,
      uPower: shared.uPower,
      uAccent: shared.uAccent,
      uWave: { value: 0.4 },
      uHighlight: { value: 0 },
      uHighlightSection: { value: 0 },
    }),
  });
}

export function createBoardMaterial(shared: SharedUniforms, palette: string[]) {
  return new THREE.ShaderMaterial({
    vertexShader: boardVertex,
    fragmentShader: boardFragment,
    fog: true,
    side: THREE.DoubleSide,
    uniforms: fogged({
      uTime: shared.uTime,
      uPower: shared.uPower,
      uAccent: shared.uAccent,
      uColors: { value: palette.map((hex) => new THREE.Color(hex)) },
    }),
  });
}

export function createLampMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: lampVertex,
    fragmentShader: lampFragment,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime,
      uPower: shared.uPower,
      /* Above 1.0 on purpose: the bloom pass keys off it. */
      uColor: { value: new THREE.Color('#fff2dc').multiplyScalar(2.4) },
    },
  });
}

export function createBeamMaterial(shared: SharedUniforms, intensity: number) {
  return new THREE.ShaderMaterial({
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uPower: shared.uPower,
      uIntensity: { value: intensity },
      uColor: { value: new THREE.Color('#ffe7c2') },
    },
  });
}

export function createGlowMaterial(
  shared: SharedUniforms,
  options: { color: string; size: number; flash: boolean; strength?: number },
) {
  return new THREE.ShaderMaterial({
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: fogged({
      uTime: shared.uTime,
      uPower: shared.uPower,
      uSize: { value: options.size },
      uRate: { value: 1 },
      uFlash: { value: options.flash ? 1 : 0 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color(options.color).multiplyScalar(options.strength ?? 1) },
    }),
  });
}

export function createSkyMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: shared.uTime,
      uAccent: shared.uAccent,
      uZenith: { value: new THREE.Color('#05040a') },
      uHorizon: { value: new THREE.Color('#2a1f3a') },
    },
  });
}
