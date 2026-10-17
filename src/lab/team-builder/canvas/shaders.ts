/**
 * GLSL for the spatial team builder.
 *
 * Everything is emissive and linear: values above 1.0 are deliberate, they are
 * what the bloom pass picks up, and the composer's tone mapping brings the frame
 * back into range. Each shader also carries three's tone-mapping chunk, which
 * is inert while the composer renders to its own targets and takes over on the
 * lightest quality tier, where there is no composer.
 *
 * Anti-aliasing is analytic: one `fwidth` at the top of each
 * shader gives the width of a pixel in metres, and every line and ring fades
 * over that width, so the markings stay crisp at any zoom without MSAA and fade
 * out instead of shimmering where they get thinner than a pixel.
 */

export const SLOTS = 11;
export const IMPACTS = 4;

const lib = /* glsl */ `
  float band(float d, float w, float aa) {
    return 1.0 - smoothstep(w - aa, w + aa, abs(d));
  }
  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
  float gridLines(vec2 p, float spacing, float w, float aa) {
    vec2 cell = abs(fract(p / spacing + 0.5) - 0.5) * spacing;
    vec2 g = 1.0 - smoothstep(vec2(w - aa), vec2(w + aa), cell);
    /* Fade a grid out before its cells shrink toward a pixel, where it would moire. */
    return max(g.x, g.y) * (1.0 - smoothstep(spacing * 0.08, spacing * 0.3, aa));
  }
`;

/* ------------------------------------------------------------------ *
 * The pitch and the arena floor: one plane, so there is no seam
 * ------------------------------------------------------------------ */

export const pitchVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

export const pitchFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uMotion;                  /* 0 under reduced motion: sweeps and drifts hold still */
  uniform vec2 uHalf;                     /* half extents of the field of play */
  uniform vec4 uSlots[${SLOTS}];          /* x, z, targeted 0..1, occupied 0..1 */
  uniform vec3 uSlotColors[${SLOTS}];     /* role neon, pre-scaled by how well the dragged player suits it */
  uniform vec4 uImpacts[${IMPACTS}];      /* x, z, start time, strength */
  uniform vec3 uImpactColors[${IMPACTS}];
  uniform vec3 uGridColor;
  uniform vec3 uLineColor;
  uniform vec3 uGlassColor;
  uniform float uFocusZ;                  /* the line of the pitch being targeted */
  uniform float uFocus;                   /* 0..1, how strongly */
  varying vec3 vWorld;
  ${lib}

  /* A studio for the glass to reflect: two soft light bars, one cool, one magenta. */
  vec3 studio(vec3 r) {
    float key = (1.0 - smoothstep(0.0, 0.16, abs(r.y - 0.42))) * (1.0 - smoothstep(0.25, 1.0, abs(r.x + 0.25)));
    float rim = (1.0 - smoothstep(0.0, 0.1, abs(r.y - 0.2))) * (1.0 - smoothstep(0.35, 0.9, abs(r.x - 0.55)));
    return vec3(0.45, 0.62, 1.0) * key * 0.9 + vec3(0.95, 0.3, 0.65) * rim * 0.45;
  }

  void main() {
    vec2 p = vWorld.xz;
    vec2 fw = fwidth(p);
    float aa = max(max(fw.x, fw.y), 1e-4) * 1.1;
    float edge = sdBox(p, uHalf);
    float r = length(p);

    /* Impacts: a ring runs out from each drop and bends the grid as it passes. */
    float wave = 0.0;
    vec3 waveColor = vec3(0.0);
    vec2 warp = vec2(0.0);
    for (int i = 0; i < ${IMPACTS}; i++) {
      vec4 im = uImpacts[i];
      float age = uTime - im.z;
      if (age < 0.0 || age > 1.9) continue;
      vec2 d = p - im.xy;
      float dist = length(d);
      float front = mix(9.0, age * 36.0, uMotion);
      float x = (dist - front) / 2.4;
      float ring = exp(-x * x) * (1.0 - age / 1.9) * im.w;
      float flash = exp(-dist * dist / 30.0) * exp(-age * 5.0) * im.w;
      wave += ring;
      waveColor += uImpactColors[i] * (ring * 1.6 + flash * 1.3);
      warp += (d / max(dist, 0.001)) * ring * 1.1 * uMotion;
    }
    vec2 g = p + warp;

    /* The arena floor: near-black, with slow rings and a coarse grid fading out with distance. */
    vec3 col = vec3(0.0035, 0.0045, 0.011);
    float distFade = 1.0 - smoothstep(70.0, 300.0, r);
    float ringD = (fract(r / 16.0 - uTime * 0.012 * uMotion) - 0.5) * 16.0;
    col += uGridColor * band(ringD, 0.06, aa) * 0.07 * distFade * smoothstep(4.0, 14.0, edge);
    col += uGridColor * gridLines(g, 14.0, 0.05, aa) * 0.035 * distFade * smoothstep(2.0, 10.0, edge);

    /*
     * Everything from here to the markings lives on the pitch or just round
     * it, so the far arena floor (a large share of the screen) skips it. The
     * branch is safe because the pixel width aa was taken with fwidth above
     * it, where every pixel in a quad still runs.
     */
    float slab = 0.0;
    if (edge < 22.0) {
      /* The pitch itself: a slab of dark glass with a lit rim, reflecting a studio. */
      slab = 1.0 - smoothstep(3.0 - aa, 3.0 + aa, edge);
      vec3 view = normalize(cameraPosition - vWorld);
      float grazing = 1.0 - clamp(view.y, 0.0, 1.0);
      float fresnel = 0.04 + 0.96 * grazing * grazing * grazing * grazing * grazing;
      vec3 glass = uGlassColor * (0.6 + 0.4 * (1.0 - smoothstep(-uHalf.y, uHalf.y, p.y)));
      glass += studio(vec3(-view.x, view.y, -view.z)) * fresnel;
      glass += vec3(0.004, 0.009, 0.016) * smoothstep(-0.6, 0.6, sin(p.y * 0.2992)) * step(edge, 0.0);
      col = mix(col, glass, slab);
      col += uGridColor * band(edge - 3.0, 0.07, aa) * 0.9;
      col += uGridColor * exp(-max(edge - 3.0, 0.0) * 0.35) * 0.018 * step(3.0, edge);

      float inField = 1.0 - smoothstep(-aa, aa, edge);
      float minor = gridLines(g, 3.5, 0.03, aa);
      float major = gridLines(g, 10.5, 0.05, aa);
      col += uGridColor * (minor * 0.05 + major * 0.15) * slab;

      /* Zones: the thirds of the pitch breathe out of phase; the targeted line lights up. */
      float third = floor((p.y + uHalf.y) / (uHalf.y * 2.0 / 3.0));
      float pulse = 0.5 + 0.5 * sin(uTime * 1.4 * uMotion + third * 2.1);
      col += uGridColor * inField * 0.012 * pulse;
      float fz = (p.y - uFocusZ) / 7.5;
      col += uGridColor * inField * exp(-fz * fz) * uFocus * 0.09;
      col += uGridColor * band(p.y - uFocusZ, 0.05, aa) * inField * uFocus * 0.5;

      /* A scan line sweeps the length of the pitch every few seconds. */
      float scanZ = mix(uHalf.y + 40.0, -uHalf.y - 40.0, fract(uTime * 0.14));
      float sz = (p.y - scanZ) / 1.4;
      col += uGridColor * inField * exp(-sz * sz) * 0.28 * uMotion;
      col += uGridColor * inField * exp(-max(p.y - scanZ, 0.0) * 0.08) * step(scanZ, p.y) * 0.015 * uMotion;

      /* A pad of light under every formation slot, and a ring round the one being targeted. */
      for (int i = 0; i < ${SLOTS}; i++) {
        vec4 s = uSlots[i];
        float d = length(p - s.xy);
        col += uSlotColors[i] * exp(-d * d / 20.0) * (0.06 + 0.34 * s.z + 0.1 * s.w);
        col += uSlotColors[i] * band(d - 4.2 - 0.35 * sin(uTime * 7.0 * uMotion), 0.09, aa) * s.z * 1.4;
      }

      /* Regulation markings, 12 cm wide, drawn on the warped coordinates so ripples bend them. */
      float w = 0.06;
      float lines = band(edge, w, aa);
      lines = max(lines, band(g.y, w, aa) * step(abs(g.x), uHalf.x));
      lines = max(lines, band(length(g) - 9.15, w, aa));
      lines = max(lines, 1.0 - smoothstep(0.22 - aa, 0.22 + aa, length(g)));
      for (int e = 0; e < 2; e++) {
        float s = e == 0 ? 1.0 : -1.0;
        vec2 goal = vec2(0.0, s * uHalf.y);
        lines = max(lines, band(sdBox(g - (goal - vec2(0.0, s * 8.25)), vec2(20.16, 8.25)), w, aa));
        lines = max(lines, band(sdBox(g - (goal - vec2(0.0, s * 2.75)), vec2(9.16, 2.75)), w, aa));
        vec2 spot = goal - vec2(0.0, s * 11.0);
        lines = max(lines, 1.0 - smoothstep(0.22 - aa, 0.22 + aa, length(g - spot)));
        lines = max(lines, band(length(g - spot) - 9.15, w, aa) * step(16.5, abs(g.y - goal.y)));
        lines = max(lines, band(sdBox(g - (goal + vec2(0.0, s * 1.2)), vec2(3.66, 1.2)), w, aa));
        lines = max(lines, band(length(g - vec2(-uHalf.x, goal.y)) - 1.0, w, aa) * inField);
        lines = max(lines, band(length(g - vec2(uHalf.x, goal.y)) - 1.0, w, aa) * inField);
      }
      col += uLineColor * lines * 0.95 * slab;
    }

    col += waveColor + uGridColor * wave * 0.4 * slab;

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * Holographic formation nodes
 * ------------------------------------------------------------------ */

/** The dashed ring on the grass: local xy is the ring plane, in metres. */
export const ringVertex = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHover;
  uniform float uOccupied;
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float aa = fwidth(r) * 1.2;
    float a = atan(vLocal.y, vLocal.x) / 6.28318;
    float spin = uTime * (0.08 + uHover * 0.5) * uMotion;
    float dashes = smoothstep(0.18, 0.24, abs(fract(a * 18.0 + spin) - 0.5));
    dashes = mix(dashes, 1.0, uOccupied * 0.8);
    float outer = 1.0 - smoothstep(0.06 - aa, 0.06 + aa, abs(r - 2.95));
    float inner = (1.0 - smoothstep(0.18 - aa, 0.18 + aa, abs(r - 2.55))) * dashes;
    float level = outer * (0.7 + 1.6 * uHover) + inner * (0.45 + 1.8 * uHover + 0.3 * uOccupied);
    gl_FragColor = vec4(uColor * level * 1.6, clamp(level, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Faceted hologram crystal: fresnel edges, scan lines climbing it, brighter
 * when targeted. Lit in view space with the normal matrix, because the
 * crystal is scaled non-uniformly (taller than wide) and a model-matrix
 * normal would tilt the wrong way.
 */
export const holoVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    vHeight = position.y;
    gl_Position = projectionMatrix * mv;
  }
`;

export const holoFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHover;
  uniform float uTime;
  uniform float uMotion;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  void main() {
    /* Clamped: rounding can put |dot| a hair over 1, and pow() of a negative base is NaN, which bloom smears into a flashing block. */
    float facing = min(abs(dot(normalize(vNormal), normalize(vView))), 1.0);
    float fres = pow(max(1.0 - facing, 0.0), 1.6);
    float scan = smoothstep(0.55, 1.0, sin(vHeight * 14.0 - uTime * 5.0 * uMotion));
    float level = (0.18 + 1.5 * fres + 0.35 * scan) * (1.0 + 1.8 * uHover);
    float alpha = clamp(0.28 + fres * 0.7 + 0.25 * uHover, 0.0, 1.0);
    gl_FragColor = vec4(uColor * level, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The light column under a node: fades upward, brightest at its silhouette. View space, as the crystal, for its stretch. */
export const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

export const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLevel;
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fade = pow(max(1.0 - vUv.y, 0.0), 1.6);
    float silhouette = pow(max(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 0.0), 1.2);
    float flow = 0.7 + 0.3 * sin(vUv.y * 18.0 - uTime * 4.0 * uMotion);
    float a = fade * (0.15 + 0.85 * silhouette) * flow * uLevel;
    gl_FragColor = vec4(uColor * 1.8, clamp(a, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * GPU particles: the burst on a drop, and dust hanging in the arena
 * ------------------------------------------------------------------ */

/**
 * One pool of points serves every burst. Each particle belongs to one of the
 * IMPACTS slots (aBurst) and is simulated entirely from its seed and the age of
 * its burst, so a new burst costs a few uniform writes and no buffer upload.
 */
export const burstVertex = /* glsl */ `
  attribute float aBurst;
  attribute vec4 aSeed;                   /* heading, speed, lift, size/spark 0..1 */
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uOrigins[${IMPACTS}];
  uniform float uStarts[${IMPACTS}];
  uniform float uStrengths[${IMPACTS}];
  uniform vec3 uColors[${IMPACTS}];
  varying float vLife;
  varying vec3 vColor;
  void main() {
    int b = int(aBurst + 0.5);
    float age = uTime - uStarts[b];
    float life = 1.0 - age / 1.4;
    vLife = life;
    vColor = mix(vec3(1.0), uColors[b], 0.35 + 0.6 * aSeed.w);
    if (age < 0.0 || life <= 0.0 || uStrengths[b] <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec3 heading = vec3(cos(aSeed.x), 0.0, sin(aSeed.x));
    float travel = aSeed.y * (1.0 - exp(-age * 3.2)) / 3.2;
    vec3 p = uOrigins[b] + heading * travel;
    p.y += aSeed.z * age - 9.0 * age * age;
    p.y = max(p.y, 0.12);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.45 + aSeed.w * 0.9) * uPixelRatio * (300.0 / -mv.z) * (0.35 + 0.65 * life) * uStrengths[b];
  }
`;

export const burstFragment = /* glsl */ `
  varying float vLife;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = exp(-d * d * 3.5) * (1.0 - smoothstep(0.75, 1.0, d)) * clamp(vLife * 1.6, 0.0, 1.0);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * 3.2, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const dustVertex = /* glsl */ `
  attribute vec4 aSeed;                   /* x, start height, z, speed 0..1 */
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uMotion;
  varying float vAlpha;
  void main() {
    float t = uTime * uMotion;
    float drift = t * (0.05 + aSeed.w * 0.07);
    vec3 p = vec3(
      aSeed.x + sin(drift + aSeed.z * 0.1) * 3.0,
      mod(aSeed.y + t * (0.35 + aSeed.w * 0.6), 34.0),
      aSeed.z + cos(drift * 1.3 + aSeed.x * 0.1) * 3.0
    );
    vAlpha = smoothstep(0.0, 5.0, p.y) * (1.0 - smoothstep(24.0, 34.0, p.y));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.6 + aSeed.w * 0.8) * uPixelRatio * (140.0 / -mv.z);
  }
`;

export const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = exp(-dot(c, c) * 16.0) * vAlpha * 0.55;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
