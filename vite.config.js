import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
    /* Uncomment to let the dev server forward /api and /token straight to the
       ASP.NET host, which sidesteps CORS entirely during development.
       Then set VITE_API_BASE_URL="" so requests stay same-origin. */
    // proxy: {
    //   '/api':   { target: 'https://localhost:44301', changeOrigin: true, secure: false },
    //   '/token': { target: 'https://localhost:44301', changeOrigin: true, secure: false },
    // },
  },
  /* The lab's post-processing, spring and gesture libraries are imported only by /lab/team-builder, so the
     dev server would discover them on the first visit, re-bundle, and reload the page halfway through
     rendering it (two copies of React, "invalid hook call"). Listed here, they are bundled at startup. */
  optimizeDeps: {
    include: ['@use-gesture/react', '@react-spring/three', '@react-three/postprocessing', 'postprocessing', 'camera-controls'],
  },
  /* `npm run preview` serves the production build (dist/) — what start-production.bat
     uses for a client demo that should not carry the dev server's HMR websocket. */
  preview: {
    port: 4173,
    open: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        /* A function, not the object form: the object form also sweeps each package's dependencies
           into its chunk, which put react-dom/client and Vite's preload helper inside the r3f chunk —
           so the entry imported it, and every page preloaded three.js. */
        manualChunks(id) {
          /* Build-time helpers shared by every dynamic import: pinned to the chunk the entry already loads. */
          if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload-polyfill') || id.includes('commonjsHelpers')) {
            return 'vendor';
          }
          if (!id.includes('node_modules')) return undefined;
          const pkg = (name) => new RegExp(`[\\\\/]node_modules[\\\\/]${name}[\\\\/]`).test(id);
          /* Only /lab/team-builder uses these. In a chunk of their own, so the public page's stadium,
             which shares three and fiber with the lab, never downloads them. */
          if (
            pkg('postprocessing') ||
            pkg('@react-three[\\\\/]postprocessing') ||
            pkg('camera-controls') ||
            pkg('@react-spring') ||
            pkg('@use-gesture')
          ) {
            return 'lab-gl';
          }
          /* Shared by the lab's post-processing and the console's orbit controls. Left unassigned it was
             swept into lab-gl as a dependency, and the console's 3D page then downloaded the whole lab chunk. */
          if (pkg('three-stdlib')) return 'three-stdlib';
          if (pkg('three')) return 'three';
          /* Fiber is shared. drei is left to Rollup, so each page gets only the helpers it imports
             (the stadium's PerformanceMonitor, the lab's CameraControls) instead of one chunk of all. */
          if (pkg('@react-three[\\\\/]fiber')) return 'r3f';
          if (pkg('framer-motion') || pkg('motion-dom') || pkg('motion-utils')) return 'motion';
          if (pkg('react-hook-form') || pkg('zod') || pkg('@hookform')) return 'forms';
          if (pkg('react') || pkg('react-dom') || pkg('scheduler') || pkg('react-router') || pkg('react-router-dom') || pkg('@remix-run')) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
