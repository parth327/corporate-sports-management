import * as THREE from 'three';

let cached = null;

/**
 * A soft radial-gradient texture, built once and shared by every additive
 * sprite in the scene (pigment blooms, lamp halos, the core's glow).
 *
 * This exists as a module rather than a hook because a `spriteMaterial` with no
 * `map` renders a solid opaque quad — which is exactly the hard-edged rectangle
 * that showed up when the core's halo was left unmapped. Anything using
 * AdditiveBlending needs this texture, so it is made impossible to forget.
 */
export default function blobTexture() {
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);

  // Long, soft falloff reaching true zero before the quad edge. A gradient that
  // still has alpha at the texture border shows the sprite's square once the
  // bloom pass lifts the midtones.
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.26)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.06)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.008)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  cached = new THREE.CanvasTexture(canvas);
  cached.colorSpace = THREE.SRGBColorSpace;
  cached.needsUpdate = true;
  return cached;
}
