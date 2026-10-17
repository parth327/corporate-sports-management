Replaced files, kept for reference. Nothing imports this folder, and it is
excluded from the type check and the Tailwind scan.

When the blueprint console was added:

  App.jsx      -> src/App.tsx (router) + src/site/Landing.tsx (the old composition)
  main.jsx     -> src/main.tsx (adds BrowserRouter)
  Register.jsx -> removed with public self-registration; src/site/RegisterCta.tsx
                  explains how participants are placed instead

When the landing backdrop became the procedural stadium (2026-09-29):

  three/ArenaBackdrop.jsx, ArenaCore.jsx, CameraDrift.jsx, Floodlights.jsx,
  Motes.jsx, PigmentClouds.jsx, blobTexture.js
               -> src/three/StadiumBackdrop.tsx and src/three/stadium/

Delete it once you are happy with the replacements.
