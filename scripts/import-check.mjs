// Verifies every named import actually exists, using Node's own ESM loader,
// which enforces the same "does not provide an export named X" binding check
// a browser's module loader does. Run with: node scripts/import-check.mjs
import * as fiber from '@react-three/fiber';
import * as drei from '@react-three/drei';
import * as postprocessing from '@react-three/postprocessing';
import * as THREE from 'three';

const need = {
  '@react-three/fiber': ['Canvas', 'useFrame'],
  '@react-three/drei': ['Preload', 'Scroll', 'ScrollControls', 'useScroll'],
  '@react-three/postprocessing': ['Bloom', 'ChromaticAberration', 'EffectComposer', 'Vignette'],
};

const modules = { '@react-three/fiber': fiber, '@react-three/drei': drei, '@react-three/postprocessing': postprocessing };

let ok = true;
for (const [pkg, names] of Object.entries(need)) {
  for (const name of names) {
    const present = modules[pkg][name] !== undefined;
    console.log(`${present ? 'OK  ' : 'FAIL'} ${pkg} -> ${name}`);
    if (!present) ok = false;
  }
}

console.log('THREE.MathUtils.smoothstep:', typeof THREE.MathUtils.smoothstep);

process.exit(ok ? 0 : 1);
