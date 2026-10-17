/**
 * Mutable singletons carrying state across the DOM <-> WebGL boundary.
 *
 * Why not React state or context: the GL layer reads these inside `useFrame`,
 * sixty to a hundred and twenty times a second. Routing a value that changes
 * every frame through the reconciler would re-render a subtree for data that
 * only ever feeds an imperative lerp. A plain object read inside the frame loop
 * costs nothing and never touches React.
 *
 * Nothing here may import three.js: this module loads with the page, and the
 * renderer must stay in its own lazily-fetched chunk.
 */

/** Normalised pointer position, -1..1 on both axes. Feeds camera parallax. */
export const pointerSignal = { x: 0, y: 0 };

/**
 * The accent colour the stadium lighting is easing toward. Sections publish
 * their own accent as they enter the viewport, so the arena shifts from
 * corporate blue to trophy gold to brand magenta as you read down the page.
 */
export const themeSignal = {
  hex: '#2475B7',
  set(hex) {
    this.hex = hex;
  },
};

/** Installs the global pointer listener. Returns a teardown so strict-mode double-mounting stays clean. */
export function installSignalListeners() {
  const onPointerMove = (e) => {
    pointerSignal.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerSignal.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  return () => window.removeEventListener('pointermove', onPointerMove);
}
