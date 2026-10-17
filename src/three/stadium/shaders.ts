/**
 * GLSL for the stadium. Every surface is unlit: the "lighting" is either
 * analytic (floodlight pools on the grass) or baked into vertex colours, so
 * the scene carries no real-time lights at all.
 *
 * Shaders end with colorspace_fragment so they output sRGB the same way with
 * or without the post-processing composer; nothing is tone mapped, which keeps
 * the brand hues exact.
 */

const common = /* glsl */ `
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float aaLine(float d, float w) {
    float aa = fwidth(d) * 1.2;
    return 1.0 - smoothstep(w - aa, w + aa, abs(d));
  }
`;

/* ------------------------------------------------------------------ *
 * Turf
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
  uniform float uPower;
  uniform float uSweep;
  uniform vec2 uField;
  uniform vec3 uAccent;
  uniform vec2 uPools[4];
  varying vec3 vWorld;
  ${common}

  void main() {
    vec2 p = vWorld.xz;
    float r = length(p / uField);

    /* Mown bands across the strip, with a touch of grain so they never look printed. */
    float band = step(0.5, fract(p.x / 7.0));
    float grain = hash21(floor(p * 3.0)) * 0.035;
    vec3 grassDark = vec3(0.020, 0.080, 0.030);
    vec3 grassLight = vec3(0.035, 0.130, 0.048);
    vec3 col = mix(grassDark, grassLight, band * 0.55 + 0.25) + grain * vec3(0.2, 0.5, 0.2);

    /* Floodlight pools: four beams plus a hot centre, computed rather than rendered. */
    float light = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 q = p - uPools[i];
      light += exp(-dot(q, q) / 900.0);
    }
    light += exp(-dot(p, p) / 1400.0) * 0.8;
    light *= uPower;
    col *= 0.35 + light * 1.25;

    /* The square: a cut strip with creases, pale under the lights. */
    float strip = step(abs(p.x), 1.6) * step(abs(p.y), 10.5);
    vec3 clay = vec3(0.30, 0.22, 0.12) * (0.55 + light * 0.7);
    col = mix(col, clay, strip * 0.9);
    float crease = aaLine(abs(p.y) - 8.4, 0.07) * step(abs(p.x), 2.2);
    crease += aaLine(p.x - 1.3, 0.05) * step(abs(abs(p.y) - 9.3), 0.9);
    crease += aaLine(p.x + 1.3, 0.05) * step(abs(abs(p.y) - 9.3), 0.9);
    col = mix(col, vec3(0.85), clamp(crease, 0.0, 1.0) * 0.8 * uPower);

    /* Thirty-yard ring, dashed, and the boundary rope. */
    float ring = aaLine(r - 0.58, 0.004) * step(0.5, fract(atan(p.y, p.x) * 24.0 / 3.14159));
    col = mix(col, vec3(0.75), ring * 0.55 * uPower);
    float rope = aaLine(r - 0.965, 0.006);
    col = mix(col, vec3(0.95, 0.93, 0.88), rope * 0.9 * uPower);

    /* Outside the rope: the apron darkens toward the wall. */
    col *= mix(1.0, 0.55, smoothstep(0.97, 1.08, r));

    /* A slow sweep of the section's colour across the grass. */
    float along = dot(p, normalize(vec2(0.8, 0.6)));
    /* Squared by hand: pow() with a negative base is undefined in GLSL and NaN on some drivers. */
    float offset = (along - uSweep) / 9.0;
    float sweep = exp(-offset * offset);
    col += uAccent * sweep * 0.22 * uPower;

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * Seats — one instanced draw, with a travelling crowd wave
 * ------------------------------------------------------------------ */

export const seatVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec4 aParams; /* angle 0..1, seed, height 0..1, section */
  uniform float uTime;
  uniform float uPower;
  uniform float uWave;
  uniform float uHighlight;
  uniform float uHighlightSection;
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    float angle = aParams.x;
    float seed = aParams.y;
    float occupied = step(0.22, seed);

    /* The wave runs round the bowl; occupied seats rise as it passes. */
    float phase = fract(angle * 2.0 - uTime * 0.06);
    float wave = smoothstep(0.0, 0.03, phase) * (1.0 - smoothstep(0.03, 0.09, phase)) * uWave;
    float lift = wave * occupied;

    float leader = uHighlight * (1.0 - step(0.5, abs(aParams.w - uHighlightSection)));
    float pulse = leader * (0.55 + 0.45 * sin(uTime * 3.2 + angle * 40.0));

    vec3 transformed = position;
    transformed.y += lift * 0.45 + position.y * lift * 0.6;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float intro = smoothstep(seed * 0.6, seed * 0.6 + 0.4, uPower);
    float base = mix(0.18, 0.62, occupied) * (0.75 + aParams.z * 0.45);
    vColor = instanceColor * base * intro;
    vGlow = (lift * 1.8 + pulse * 1.4) * intro;
    #include <fog_vertex>
  }
`;

export const seatFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    vec3 col = vColor * (1.0 + vGlow) + uAccent * vGlow * 0.18;
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * Perimeter LED boards
 * ------------------------------------------------------------------ */

export const boardVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

export const boardFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uPower;
  uniform vec3 uColors[4];
  uniform vec3 uAccent;
  varying vec2 vUv;
  ${common}

  void main() {
    /* Panels of brand colour scrolling round the bowl, each carrying a row of "type". */
    float u = vUv.x * 64.0 - uTime * 0.35;
    float panel = floor(u);
    int index = int(mod(panel, 4.0));
    vec3 base = index == 0 ? uColors[0] : index == 1 ? uColors[1] : index == 2 ? uColors[2] : uColors[3];

    float local = fract(u);
    float glyphs = step(0.45, hash21(vec2(floor(local * 18.0), panel))) * step(0.3, vUv.y) * step(vUv.y, 0.7);
    float seam = smoothstep(0.0, 0.03, local) * smoothstep(1.0, 0.97, local);
    vec3 col = mix(base * 0.55, vec3(1.0), glyphs * 0.55) * seam;
    col = mix(col, uAccent, 0.18);

    gl_FragColor = vec4(col * (0.25 + 1.1 * uPower), 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * Floodlight lamps and beams
 * ------------------------------------------------------------------ */

export const lampVertex = /* glsl */ `
  attribute float aDelay;
  uniform float uPower;
  uniform float uTime;
  varying float vLevel;
  void main() {
    float on = smoothstep(aDelay, aDelay + 0.08, uPower);
    /* A fluorescent strike: two stutters before the lamp holds. */
    float strike = step(0.5, fract(sin((uPower - aDelay) * 90.0) * 43758.5)) * (1.0 - smoothstep(aDelay + 0.08, aDelay + 0.2, uPower));
    vLevel = max(on - strike * 0.7, 0.0) * (0.96 + 0.04 * sin(uTime * 40.0 + aDelay * 100.0));
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const lampFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vLevel;
  void main() {
    gl_FragColor = vec4(mix(vec3(0.06), uColor, vLevel), 1.0);
    #include <colorspace_fragment>
  }
`;

export const beamVertex = /* glsl */ `
  varying float vAlong;
  varying float vFacing;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 normalWorld = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vec3 toCamera = normalize(cameraPosition - world.xyz);
    vFacing = abs(dot(normalWorld, toCamera));
    vAlong = uv.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const beamFragment = /* glsl */ `
  uniform float uPower;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying float vAlong;
  varying float vFacing;
  void main() {
    /* Strong at the lamp, gone by the grass; soft at the silhouette so the cone has no edge. */
    float along = pow(vAlong, 1.6);
    float edge = pow(vFacing, 1.8);
    float a = along * edge * uIntensity * uPower;
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * Glow points: lamp halos and crowd camera flashes
 * ------------------------------------------------------------------ */

export const glowVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aSeed;
  uniform float uTime;
  uniform float uPower;
  uniform float uSize;
  uniform float uRate;
  uniform float uFlash;
  uniform float uPixelRatio;
  varying float vLevel;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float flash = pow(max(0.0, sin(uTime * (0.35 + aSeed * 0.9) * uRate + aSeed * 61.0)), 140.0);
    vLevel = mix(1.0, flash, uFlash) * uPower;
    gl_PointSize = uSize * uPixelRatio * (320.0 / -mvPosition.z) * (0.6 + 0.4 * vLevel);
    #include <fog_vertex>
  }
`;

export const glowFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  varying float vLevel;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.85, 1.0, d)) * vLevel;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * Ground around the bowl: light spill near the stands, a far city beyond
 * ------------------------------------------------------------------ */

export const groundVertex = /* glsl */ `
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

export const groundFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uPower;
  uniform vec2 uField;
  uniform vec3 uAccent;
  varying vec3 vWorld;
  ${common}

  void main() {
    vec2 p = vWorld.xz;
    float r = length(p / (uField + 42.0));
    /* Concourse light spilling onto the plaza, then the car parks' sodium grid, then dark. */
    float spill = exp(-max(r - 1.0, 0.0) * 5.0) * uPower;
    vec3 col = vec3(0.012, 0.010, 0.018) + vec3(0.05, 0.045, 0.07) * spill + uAccent * spill * 0.03;

    vec2 lot = floor(p / 9.0);
    float lamp = step(0.93, hash21(lot)) * smoothstep(1.5, 2.2, r) * (1.0 - smoothstep(4.5, 7.0, r));
    vec2 f = fract(p / 9.0) - 0.5;
    col += vec3(1.0, 0.62, 0.28) * lamp * exp(-dot(f, f) * 60.0) * 0.9 * uPower;

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * Night sky
 * ------------------------------------------------------------------ */

export const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_Position.z = gl_Position.w;
  }
`;

export const skyFragment = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uAccent;
  uniform float uTime;
  varying vec3 vDir;
  ${common}

  void main() {
    float h = clamp(vDir.y, -0.2, 1.0);
    /* Light pollution from the bowl: warm at the horizon, tinted by the section in view; black below it. */
    float glow = exp(-max(h, 0.0) * 7.0);
    vec3 col = mix(uZenith, uHorizon, glow);
    col += uAccent * glow * 0.12;
    col = mix(col, vec3(0.008, 0.007, 0.012), smoothstep(0.0, -0.06, h));

    vec2 cell = floor(vec2(atan(vDir.z, vDir.x) * 260.0, h * 520.0));
    float star = step(0.9975, hash21(cell)) * smoothstep(0.08, 0.5, h);
    star *= 0.55 + 0.45 * sin(uTime * (1.0 + hash21(cell + 7.0) * 3.0) + hash21(cell) * 20.0);
    col += vec3(star * 0.55);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
