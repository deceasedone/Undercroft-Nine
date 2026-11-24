// Procedural generation of Undercroft Nine: a sealed underground city on a bounded grid.
import * as THREE from 'three';

export const CELL = 16;
export const N = 19;
export const HALF = (N * CELL) / 2;
export const CEIL = 84;
export const MID = (N - 1) / 2;
export const cellCenter = (i) => (i - MID) * CELL;
export const START_CELL = [9, 15];

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const NEON = {
  mag: [1.0, 0.08, 0.72],
  cyan: [0.08, 0.85, 1.0],
  yel: [1.0, 0.78, 0.1],
  vio: [0.5, 0.18, 1.0],
  red: [1.0, 0.1, 0.08],
  white: [0.85, 0.92, 1.0],
  warm: [1.0, 0.62, 0.3],
};

const COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uPlayer;
uniform sampler2D uRegion;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
vec3 district(vec2 p){ return texture2D(uRegion, (p/48.0 + 4.0)/8.0).rgb; }
float fogF(vec3 w, float k){
  float d = length(cameraPosition - w);
  return 1.0 - exp(-uFogDensity*uFogDensity*d*d*k);
}
float neonFlicker(float s){
  float pulse = 0.82 + 0.18*sin(uTime*(2.0+s*6.0) + s*50.0);
  float rnd = fract(sin(floor(uTime*14.0)*12.9898 + s*78.233) * 43758.5453);
  float faulty = step(0.82, s);
  float burst = step(0.45, fract(sin(floor(uTime*0.7 + s*10.0))*91.3));
  float flick = mix(1.0, 0.08 + 0.92*step(0.4, rnd), faulty*burst);
  float dip = 1.0 - 0.6*step(0.993, rnd);
  return pulse*flick*dip;
}
`;

const BOX_VERT = /* glsl */ `
attribute vec2 aData;
varying vec3 vW; varying vec3 vN; varying vec2 vData; varying vec3 vScale; varying vec3 vLocal;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz; vN = normal; vData = aData;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLocal = position * vScale;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const BOX_FRAG = COMMON + /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec2 vData; varying vec3 vScale; varying vec3 vLocal;
void main(){
  vec3 n = normalize(vN);
  float seed = vData.x * 97.0; float kind = vData.y;
  float side = 1.0 - step(0.5, abs(n.y));
  bool xf = abs(n.x) > 0.5;
  vec2 uv = xf ? vec2(vLocal.z, vLocal.y) : vec2(vLocal.x, vLocal.y);
  float hAbove = vLocal.y + vScale.y*0.5;
  float shade = 0.6 + 0.25*n.y + 0.12*n.x + 0.06*n.z;
  vec3 dc = district(vW.xz);
  vec3 col; vec3 emis = vec3(0.0);

  if (kind < 0.5) {
    // kind 0: tower with procedural windows
    vec3 base = mix(vec3(0.030,0.034,0.048), vec3(0.055,0.045,0.062), hash(vec2(seed,1.0)));
    float fw = 1.5 + floor(hash(vec2(seed,2.0))*3.0)*0.45;
    float fh = 2.6 + floor(hash(vec2(seed,5.0))*2.0)*0.7;
    vec2 g = vec2(uv.x/fw + 0.5, hAbove/fh);
    vec2 id = floor(g); vec2 f = fract(g);
    float win = smoothstep(0.14,0.2,f.x)*smoothstep(0.86,0.8,f.x)*smoothstep(0.26,0.32,f.y)*smoothstep(0.8,0.74,f.y);
    float face = n.x*1.0 + n.z*2.0;
    float r = hash(id + vec2(seed + face*7.0, seed*0.37));
    float dens = 0.55 + 0.35*hash(vec2(seed,3.0));
    float lit = step(dens, r) * step(0.22, hash(vec2(id.y, seed+face))) * step(1.0, id.y);
    lit *= 1.0 - step(0.985, r) * step(0.5, fract(sin(floor(uTime*7.0) + r*311.0)*4375.5));
    vec3 warm = vec3(1.0,0.66,0.32);
    vec3 wc = mix(warm, dc, step(0.55, hash(vec2(id.y*3.1, seed))));
    wc = mix(wc, vec3(0.6,0.8,1.0), step(0.9, r)*0.7);
    float inner = 0.55 + 0.45*hash(id*1.7 + seed);
    emis = wc * win * lit * side * inner * 0.45;
    float seam = smoothstep(0.03,0.0,f.y) + smoothstep(0.03,0.0,f.x)*0.5;
    col = base * 0.72 * shade * (0.8 + 0.4*vnoise(uv*0.6 + seed)) * (1.0 - 0.35*seam*side);
    col = mix(col, vec3(0.008,0.010,0.018), win*side);
    float band = step(2.75,hAbove)*step(hAbove,3.0)*side*step(0.55,hash(vec2(seed,9.0)));
    emis += dc * band * 0.6 * neonFlicker(fract(seed*0.123)*0.8);
    col += dc * 0.06 * exp(-hAbove*0.10) * side;
  } else if (kind < 1.5) {
    // kind 1: shipping container
    float h1 = hash(vec2(seed,1.0));
    vec3 base = h1 < 0.25 ? vec3(0.20,0.07,0.04) : h1 < 0.5 ? vec3(0.03,0.13,0.15) : h1 < 0.75 ? vec3(0.17,0.13,0.03) : vec3(0.05,0.07,0.16);
    float corr = 0.78 + 0.22*sin(uv.x*9.0);
    float edge = step(abs(uv.x), (xf ? vScale.z : vScale.x)*0.5 - 0.12) * step(0.1, hAbove) * step(hAbove, vScale.y - 0.1);
    col = base * shade * mix(0.45, corr, edge*side) * (0.7 + 0.5*vnoise(uv*1.3 + seed));
    col += dc * 0.035 * side;
  } else if (kind < 2.5) {
    // kind 2: structural metal (also pipes)
    col = vec3(0.028,0.032,0.042) * shade * (0.8 + 0.4*vnoise(vW.xz*0.8 + vW.y));
    col += dc * 0.05 * exp(-vW.y*0.08);
  } else {
    // kind 3: cavern rock
    float rk = vnoise(vec2(uv.x*0.12, vW.y*0.12)) * 0.6 + vnoise(vec2(uv.x*0.5, vW.y*0.5)) * 0.4;
    col = vec3(0.022,0.02,0.028) * (0.4 + rk) * shade;
    col += dc * 0.03 * exp(-vW.y*0.05);
  }

  vec3 toP = uPlayer - vW; float d2 = dot(toP,toP);
  float nl = max(dot(n, normalize(toP)), 0.0)*0.8 + 0.2;
  col += vec3(0.10,0.42,0.52) * nl * 0.10 / (1.0 + d2*0.03);

  float f1 = fogF(vW, 1.0);
  float f2 = fogF(vW, 0.3);
  vec3 outc = mix(col, uFogColor, f1) + emis * (1.0 - f2);
  gl_FragColor = vec4(outc, 1.0);
}`;

const NEON_VERT = /* glsl */ `
attribute vec3 aColor; attribute float aSeed;
varying vec3 vColor; varying float vSeed; varying vec3 vW;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz; vColor = aColor; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const NEON_FRAG = COMMON + /* glsl */ `
varying vec3 vColor; varying float vSeed; varying vec3 vW;
void main(){
  vec3 c = vColor * 1.0 * neonFlicker(vSeed);
  float f = fogF(vW, 0.35);
  gl_FragColor = vec4(mix(c, uFogColor, f), 1.0);
}`;

const SIGN_VERT = /* glsl */ `
attribute vec3 aColor; attribute vec2 aSign;
varying vec3 vColor; varying vec2 vSign; varying vec3 vW; varying vec2 vUv;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz; vColor = aColor; vSign = aSign; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SIGN_FRAG = COMMON + /* glsl */ `
uniform sampler2D uAtlas;
varying vec3 vColor; varying vec2 vSign; varying vec3 vW; varying vec2 vUv;
void main(){
  float idx = vSign.x;
  float c = mod(idx, 2.0); float r = floor(idx/2.0);
  vec2 a = vec2((c + vUv.x)/2.0, 1.0 - (r + 1.0 - vUv.y)/8.0);
  float m = texture2D(uAtlas, a).r;
  float scan = 0.82 + 0.18*sin(vW.y*9.0 - uTime*5.0);
  float fl = neonFlicker(vSign.y);
  vec3 col = vColor * (m*1.1 + 0.03) * scan * fl;
  float f = fogF(vW, 0.35);
  gl_FragColor = vec4(col * (1.0 - f), 1.0);
}`;

const GROUND_VERT = /* glsl */ `
varying vec3 vW;
void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`;

const GROUND_FRAG = COMMON + /* glsl */ `
varying vec3 vW;
void main(){
  vec2 p = vW.xz;
  vec3 dc = district(p);
  float n = vnoise(p*0.11)*0.6 + vnoise(p*0.43)*0.4;
  vec3 col = vec3(0.014,0.015,0.02) * (0.6 + 0.8*vnoise(p*2.3));
  vec2 t = abs(fract(p/4.0) - 0.5);
  col += vec3(0.008,0.009,0.012) * smoothstep(0.47,0.5,max(t.x,t.y));
  vec2 c = p/16.0 + 9.5; vec2 ci = floor(c); vec2 cf = fract(c);
  float sx = step(mod(ci.x,3.0),0.5); float sz = step(mod(ci.y,3.0),0.5);
  float laneX = sx*(1.0-sz) * smoothstep(0.014,0.006,abs(cf.x-0.5)) * step(0.45,fract(p.y/4.0));
  float laneZ = sz*(1.0-sx) * smoothstep(0.014,0.006,abs(cf.y-0.5)) * step(0.45,fract(p.x/4.0));
  col += dc * 0.28 * (laneX + laneZ);
  float kerb = (sx*(1.0-sz))*smoothstep(0.02,0.0,abs(abs(cf.x-0.5)-0.46)) + (sz*(1.0-sx))*smoothstep(0.02,0.0,abs(abs(cf.y-0.5)-0.46));
  col += dc * 0.08 * kerb;
  float pud = smoothstep(0.48,0.6,n);
  vec2 rp = fract(p*0.35 + vec2(hash(floor(p*0.35)), 0.0)) - 0.5;
  float ripple = 0.5 + 0.5*sin(length(rp)*46.0 - uTime*7.0);
  vec3 refl = dc*0.09 + vec3(0.015,0.02,0.035);
  col = mix(col, refl*(0.9 + 0.1*ripple), pud*0.85);
  col += dc * 0.03;
  vec3 toP = uPlayer - vW; float d2 = dot(toP,toP);
  col += vec3(0.10,0.42,0.52) * (0.4 + 0.6*pud) * 0.13 / (1.0 + d2*0.03);
  float dp = length(p - uPlayer.xz);
  float low = smoothstep(9.0, 2.0, uPlayer.y);
  float rip = sin(dp*5.0 - uTime*10.0) * exp(-dp*0.3) * low;
  col += vec3(0.08,0.35,0.45) * max(rip, 0.0) * (0.35 + 0.65*pud) * 0.55;
  gl_FragColor = vec4(mix(col, uFogColor, fogF(vW, 1.0)), 1.0);
}`;

const SIGN_TEXT = [
  'RAMEN 24H', 'NEURO//LINK', 'ネオン横丁', 'HOTEL NADIR',
  '酒 BAR 酒', 'SYNTHMEAT', 'OXYGEN ¥9', 'DATA PAWN',
  '夜市 →', 'NO SIGNAL', 'KIRA CLINIC', 'ギガ電脳',
  'SLEEP PODS', 'CHROME DOC', 'DEEP LEVEL 9', '龍 NOODLE',
];

function buildSignAtlas() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  SIGN_TEXT.forEach((txt, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    let size = 78;
    do { g.font = `900 ${size}px "Arial Black", Impact, "Yu Gothic", "Meiryo", sans-serif`; size -= 4; }
    while (g.measureText(txt).width > 440 && size > 20);
    g.fillText(txt, x + 256, y + 66);
    g.lineWidth = 5;
    if (i % 3 !== 1) g.strokeRect(x + 14, y + 12, 484, 104);
    else { g.fillRect(x + 14, y + 12, 484, 5); g.fillRect(x + 14, y + 111, 484, 5); }
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

export function generateCity(seed, opts = {}) {
  const nodeCount = opts.nodes ?? 8;
  const rnd = mulberry32(seed);
  const R = (a, b) => a + rnd() * (b - a);
  const group = new THREE.Group();

  const fogColor = new THREE.Color(0x07050f);
  const shared = {
    uTime: { value: 0 },
    uFogColor: { value: fogColor },
    uFogDensity: { value: 0.0105 },
    uPlayer: { value: new THREE.Vector3() },
    uRegion: { value: null },
  };

  // district colour map (8x8, linearly filtered so districts bleed into each other)
  const regionData = new Uint8Array(8 * 8 * 4);
  const regionCols = [];
  for (let i = 0; i < 64; i++) {
    const r = rnd();
    const c = r < 0.34 ? NEON.cyan : r < 0.68 ? NEON.mag : r < 0.84 ? NEON.vio : NEON.yel;
    regionCols.push(c);
    regionData.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i * 4);
  }
  const regionTex = new THREE.DataTexture(regionData, 8, 8, THREE.RGBAFormat);
  regionTex.magFilter = THREE.LinearFilter; regionTex.minFilter = THREE.LinearFilter;
  regionTex.needsUpdate = true;
  shared.uRegion.value = regionTex;
  const districtColor = (x, z) => {
    const ix = Math.min(7, Math.max(0, Math.floor(x / 48) + 4));
    const iz = Math.min(7, Math.max(0, Math.floor(z / 48) + 4));
    return regionCols[iz * 8 + ix];
  };

  const boxes = [], neons = [], signs = [], colliders = [];
  const addCollider = (x, y, z, sx, sy, sz) =>
    colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2 });
  const addBox = (x, y, z, sx, sy, sz, kind = 0, solid = true, s = rnd()) => {
    boxes.push(x, y, z, sx, sy, sz, s, kind);
    if (solid) addCollider(x, y, z, sx, sy, sz);
  };
  const addNeon = (x, y, z, sx, sy, sz, c, s = rnd(), k = 1) =>
    neons.push(x, y, z, sx, sy, sz, c[0] * k, c[1] * k, c[2] * k, s);
  const pipes = [], holoSpots = [], ventSpots = [];
  const addPipe = (x, y, z, d, len, axis) => pipes.push(x, y, z, d, len, axis, rnd());
  const addSign = (x, y, z, w, rotY, c) => signs.push(x, y, z, w, rotY, c[0], c[1], c[2], Math.floor(rnd() * 16), rnd());

  // ---- grid layout: streets every third line, 2x2 blocks between
  const isStreet = (i, j) => i % 3 === 0 || j % 3 === 0;
  const grid = [];
  for (let i = 0; i < N; i++) {
    grid.push([]);
    for (let j = 0; j < N; j++) {
      let type = isStreet(i, j) ? 'street' : 'bldg';
      if (Math.abs(i - MID) === 1 && Math.abs(j - MID) === 1) type = 'plaza';
      grid[i].push({ type, h: 0, sx: 0, sz: 0 });
    }
  }

  // ---- choose terminal yards: one beside the spawn, the rest spread far apart
  const termCells = [[START_CELL[0] + 1, START_CELL[1] - 1]];
  const cand = [];
  for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) if (grid[i][j].type === 'bldg') cand.push([i, j]);
  for (let i = cand.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [cand[i], cand[k]] = [cand[k], cand[i]]; }
  for (let minD = 6; termCells.length < nodeCount && minD > 1; minD -= 0.75) {
    for (const c of cand) {
      if (termCells.length >= nodeCount) break;
      if (termCells.every((t) => Math.hypot(t[0] - c[0], t[1] - c[1]) >= minD)) termCells.push(c);
    }
  }
  termCells.forEach(([i, j]) => (grid[i][j].type = 'term'));
  for (const [i, j] of cand) if (grid[i][j].type === 'bldg' && rnd() < 0.09) grid[i][j].type = 'yard';

  const terminals = [];

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const cell = grid[i][j];
      const cx = cellCenter(i), cz = cellCenter(j);
      const dc = districtColor(cx, cz);

      if (cell.type === 'bldg') {
        const sx = CELL - R(0.6, 4), sz = CELL - R(0.6, 4);
        const mega = rnd() < 0.08;
        const h = mega ? CEIL : 16 + Math.pow(rnd(), 1.8) * 52;
        cell.h = h; cell.sx = sx; cell.sz = sz;
        const bs = rnd();
        addBox(cx, h / 2, cz, sx, h, sz, 0, true, bs);
        let top = h, tcx = cx, tcz = cz, tsx = sx, tsz = sz;
        if (!mega && rnd() < 0.45) {
          const h2 = R(4, 16), k = R(0.45, 0.75);
          tcx = cx + R(-1, 1); tcz = cz + R(-1, 1); tsx = sx * k; tsz = sz * k;
          addBox(tcx, h + h2 / 2, tcz, tsx, h2, tsz, 0, true, bs);
          top = h + h2;
        }
        cell.top = top; cell.tcx = tcx; cell.tcz = tcz;
        if (!mega && h > 20 && rnd() < 0.4) {
          const nC = 1 + Math.floor(rnd() * 2);
          for (let k = 0; k < nC; k++) addBox(cx, R(9, h - 4), cz, sx + 1.4, 0.45, sz + 1.4, 2, true);
        }
        const wallFaces = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const nP = Math.floor(rnd() * 3);
        for (let k = 0; k < nP; k++) {
          const [dx, dz] = wallFaces[Math.floor(rnd() * 4)];
          const d = R(0.35, 0.65), along = R(-0.42, 0.42) * (dx ? sz : sx), len = h * R(0.45, 1);
          addPipe(cx + dx * (sx / 2 + d / 2 + 0.05) + (dz ? along : 0), len / 2, cz + dz * (sz / 2 + d / 2 + 0.05) + (dx ? along : 0), d, len, 0);
        }
        if (rnd() < 0.45) {
          const [dx, dz] = wallFaces[Math.floor(rnd() * 4)];
          const d = R(0.5, 0.9), y = R(4, Math.min(h - 2, 20));
          addPipe(cx + dx * (sx / 2 + d / 2 + 0.05), y, cz + dz * (sz / 2 + d / 2 + 0.05), d, (dx ? sz : sx) + 0.4, dx ? 2 : 1);
        }
        if (!mega) {
          const nAC = Math.floor(rnd() * 3);
          for (let k = 0; k < nAC; k++) addBox(tcx + R(-0.28, 0.28) * tsx, top + 0.6, tcz + R(-0.28, 0.28) * tsz, R(1.2, 2.2), 1.2, R(1.2, 2.2), 2, true);
          if (rnd() < 0.35) {
            const td = R(2, 3), th = R(2.5, 4);
            const tx = tcx + (rnd() < 0.5 ? -1 : 1) * tsx * 0.22, tz = tcz + (rnd() < 0.5 ? -1 : 1) * tsz * 0.22;
            addBox(tx, top + 0.5, tz, td * 0.8, 1, td * 0.8, 2, false);
            addPipe(tx, top + 1 + th / 2, tz, td, th, 0);
            addCollider(tx, top + (1 + th) / 2, tz, td, 1 + th, td);
          }
        }
        if (rnd() < 0.5) {
          const y = mega ? R(14, 50) : h * R(0.35, 0.95);
          const c = rnd() < 0.7 ? dc : NEON.mag, s = rnd(), t = 0.14;
          addNeon(cx, y, cz + sz / 2 + 0.05, sx + 0.2, t, t, c, s);
          addNeon(cx, y, cz - sz / 2 - 0.05, sx + 0.2, t, t, c, s);
          addNeon(cx + sx / 2 + 0.05, y, cz, t, t, sz + 0.2, c, s);
          addNeon(cx - sx / 2 - 0.05, y, cz, t, t, sz + 0.2, c, s);
        }
        if (rnd() < 0.3) {
          const sgx = rnd() < 0.5 ? 1 : -1, sgz = rnd() < 0.5 ? 1 : -1;
          addNeon(cx + sgx * (sx / 2 + 0.05), h * 0.5, cz + sgz * (sz / 2 + 0.05), 0.16, h * R(0.4, 0.9), 0.16, rnd() < 0.5 ? dc : NEON.cyan);
        }
        if (!mega && rnd() < 0.35) {
          const ah = R(4, 11), ax = cx + R(-2, 2), az = cz + R(-2, 2);
          addBox(ax, top + ah / 2, az, 0.16, ah, 0.16, 2, false);
          addNeon(ax, top + ah + 0.15, az, 0.34, 0.34, 0.34, NEON.red, 0.9 + rnd() * 0.09);
        }
        const faces = [[1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, 1, 0], [0, -1, Math.PI]];
        for (const [dx, dz, rot] of faces) {
          const nb = grid[i + dx]?.[j + dz];
          if (!nb || nb.type === 'bldg') continue;
          const n = rnd() < 0.4 ? 1 : rnd() < 0.25 ? 2 : 0;
          for (let k = 0; k < n; k++) {
            const span = dx ? sz : sx;
            const w = Math.min(R(5, 10), span - 2);
            const y = R(5.5, Math.min(h - 3, 34));
            const off = R(-1, 1) * (span - w) * 0.5;
            const c = rnd() < 0.55 ? dc : [NEON.mag, NEON.cyan, NEON.yel][Math.floor(rnd() * 3)];
            addSign(cx + dx * (sx / 2 + 0.25) + (dz ? off : 0), y, cz + dz * (sz / 2 + 0.25) + (dx ? off : 0), w, rot, c);
          }
          if (h > 34 && rnd() < 0.12) {
            const hw = Math.min(R(7, 10), (dx ? sz : sx) - 2);
            holoSpots.push({ x: cx + dx * (sx / 2 + 0.7), y: R(20, Math.min(h - 6, 46)), z: cz + dz * (sz / 2 + 0.7), rot, w: hw });
          }
        }
      } else if (cell.type === 'yard' || cell.type === 'term') {
        const slots = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [sgx, sgz] of slots) {
          if (rnd() < (cell.type === 'term' ? 0.3 : 0.15)) continue;
          const alongX = rnd() < 0.5;
          const L = 6.1, W = 2.44, H = 2.6;
          const stack = 1 + Math.floor(rnd() * 3.4);
          for (let k = 0; k < stack; k++) {
            addBox(cx + sgx * 4.6 + R(-0.15, 0.15), H / 2 + k * H, cz + sgz * 4.9 + R(-0.15, 0.15), alongX ? L : W, H, alongX ? W : L, 1);
          }
        }
        if (cell.type === 'term') {
          terminals.push({ x: cx, z: cz, rot: Math.floor(rnd() * 4) * Math.PI / 2 });
          addCollider(cx, 1.1, cz, 1.6, 2.2, 1.6);
        } else {
          const ph = R(6, 14);
          addBox(cx, 0.3, cz, 1.2, 0.6, 1.2, 2, false);
          addNeon(cx, 0.6 + ph / 2, cz, 0.4, ph, 0.4, dc);
        }
      } else if (cell.type === 'street') {
        const si = i % 3 === 0, sj = j % 3 === 0;
        if (si && sj) {
          if (!(i === MID && j === MID) && !(i === START_CELL[0] && j === START_CELL[1])) {
            for (const [sgx, sgz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
              if (rnd() > 0.38) continue;
              const ph = R(8, 28), px = cx + sgx * 6.8, pz = cz + sgz * 6.8;
              addBox(px, 0.35, pz, 1.1, 0.7, 1.1, 2, false);
              addNeon(px, 0.7 + ph / 2, pz, 0.42, ph, 0.42, rnd() < 0.75 ? dc : NEON.yel);
            }
          }
        } else {
          const sgn = (i + j) % 2 ? 1 : -1;
          const lx = si ? cx + sgn * 6.9 : cx, lz = si ? cz : cz + sgn * 6.9;
          addBox(lx, 3.6, lz, 0.2, 7.2, 0.2, 2, false);
          const hx = si ? lx - sgn * 0.8 : lx, hz = si ? lz : lz - sgn * 0.8;
          addBox(hx, 7.25, hz, si ? 1.9 : 0.3, 0.14, si ? 0.3 : 1.9, 2, false);
          addNeon(hx, 7.12, hz, si ? 1.6 : 0.24, 0.1, si ? 0.24 : 1.6, rnd() < 0.7 ? NEON.warm : dc, rnd(), 0.9);
          if (rnd() < 0.14) {
            const vx = si ? cx + R(-3, 3) : cx + R(-5, 5), vz = si ? cz + R(-5, 5) : cz + R(-3, 3);
            addBox(vx, 0.04, vz, 1.6, 0.08, 1.6, 2, false);
            ventSpots.push([vx, vz]);
          }
        }
      }
    }
  }

  for (let i = 3; i < N - 1; i += 3) {
    for (let j = 1; j < N - 1; j++) {
      if (j % 3 === 0) continue;
      for (const axis of [0, 1]) {
        const a = axis ? grid[j][i - 1] : grid[i - 1][j];
        const b = axis ? grid[j][i + 1] : grid[i + 1][j];
        if (a.type !== 'bldg' || b.type !== 'bldg' || rnd() > 0.16) continue;
        const maxY = Math.min(a.h, b.h, 36) - 3;
        if (maxY < 11) continue;
        const y = R(10, maxY), o = R(-3, 3), len = CELL + 4.4;
        const px = axis ? cellCenter(j) + o : cellCenter(i), pz = axis ? cellCenter(i) : cellCenter(j) + o;
        addBox(px, y, pz, axis ? 3 : len, 0.5, axis ? len : 3, 2, true);
        const c = districtColor(px, pz), s = rnd() * 0.8;
        for (const sg of [-1, 1]) {
          addNeon(px + (axis ? sg * 1.45 : 0), y + 1.0, pz + (axis ? 0 : sg * 1.45), axis ? 0.08 : CELL, 0.08, axis ? CELL : 0.08, c, s);
          addNeon(px + (axis ? sg * 1.45 : 0), y - 0.3, pz + (axis ? 0 : sg * 1.45), axis ? 0.06 : CELL, 0.06, axis ? CELL : 0.06, NEON.white, s, 0.35);
        }
      }
    }
  }

  const shards = [];
  const addShard = (x, y, z) => shards.push([x, y, z, rnd() < 0.12 ? 1 : 0]);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cell = grid[i][j], cx = cellCenter(i), cz = cellCenter(j);
    if (cell.type === 'street') {
      const si = i % 3 === 0, sj = j % 3 === 0;
      if (si && sj) {
        if ((i === MID && j === MID) || (i === START_CELL[0] && j === START_CELL[1]) || rnd() > 0.22) continue;
        for (let k = 0; k < 4; k++) addShard(cx, 18 + k * 5, cz);
      } else if (rnd() < 0.16) {
        const y = rnd() < 0.75 ? R(2.2, 6) : R(14, 30), lane = R(-3, 3);
        for (let k = -1; k <= 1; k++) addShard(si ? cx + lane : cx + k * 4.5, y, si ? cz + k * 4.5 : cz + lane);
      }
    } else if (cell.type === 'yard' && rnd() < 0.7) addShard(cx - 2, 3, cz + 2);
  }

  const beaconSpots = [], powerSpots = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cell = grid[i][j], cx = cellCenter(i), cz = cellCenter(j);
    if (cell.type === 'bldg' && cell.h < CEIL && cell.top < 60) beaconSpots.push([cell.tcx, cell.top + 6.5, cell.tcz]);
    else if (cell.type === 'yard') { beaconSpots.push([cx + 2, 4, cz - 2]); powerSpots.push([cx + 2, 3, cz - 2]); }
    else if (cell.type === 'street' && i % 3 === 0 && j % 3 === 0 && !(i === MID && j === MID) && !(i === START_CELL[0] && j === START_CELL[1])) powerSpots.push([cx, 3, cz]);
  }

  const span = HALF * 2 + 16;
  addBox(0, CEIL + 1, 0, span, 2, span, 3, false);
  for (let s = 0; s < N; s += 3) {
    const p = cellCenter(s);
    addBox(p, CEIL - 2, 0, 3, 4, span, 2, false);
    addBox(0, CEIL - 2.5, p, span, 3, 3, 2, false);
    for (let k = 0; k < N; k += 2) {
      const q = cellCenter(k);
      addNeon(p, CEIL - 4.1, q, 0.22, 0.1, 9, districtColor(p, q), rnd(), 0.5);
    }
  }
  for (const sg of [-1, 1]) {
    addBox(sg * (HALF + 4), CEIL / 2, 0, 8, CEIL, span, 3, true);
    addBox(0, CEIL / 2, sg * (HALF + 4), span, CEIL, 8, 3, true);
  }
  addBox(0, 0.6, 0, 7, 1.2, 7, 2, true);
  for (const sg of [-1, 1]) {
    addNeon(sg * 3.55, 1.0, 0, 0.1, 0.1, 7.1, NEON.mag, 0.3);
    addNeon(0, 1.0, sg * 3.55, 7.1, 0.1, 0.1, NEON.mag, 0.3);
  }

  const su = (extra = {}) => ({ uTime: shared.uTime, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity, uPlayer: shared.uPlayer, uRegion: shared.uRegion, ...extra });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), eu = new THREE.Euler();
  const boxMat = new THREE.ShaderMaterial({ vertexShader: BOX_VERT, fragmentShader: BOX_FRAG, uniforms: su() });

  {
    const n = boxes.length / 8;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const data = new Float32Array(n * 2);
    const mesh = new THREE.InstancedMesh(geo, boxMat, n);
    for (let k = 0; k < n; k++) {
      const o = k * 8;
      m4.compose(v.set(boxes[o], boxes[o + 1], boxes[o + 2]), q.identity(), sc.set(boxes[o + 3], boxes[o + 4], boxes[o + 5]));
      mesh.setMatrixAt(k, m4);
      data[k * 2] = boxes[o + 6]; data[k * 2 + 1] = boxes[o + 7];
    }
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 2));
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // pipes, conduits and water tanks share the structural shader (kind 2 = dark metal)
  if (pipes.length) {
    const n = pipes.length / 7;
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1);
    const data = new Float32Array(n * 2);
    const mesh = new THREE.InstancedMesh(geo, boxMat, n);
    for (let k = 0; k < n; k++) {
      const o = k * 7, axis = pipes[o + 5];
      q.setFromEuler(eu.set(axis === 2 ? Math.PI / 2 : 0, 0, axis === 1 ? Math.PI / 2 : 0));
      m4.compose(v.set(pipes[o], pipes[o + 1], pipes[o + 2]), q, sc.set(pipes[o + 3], pipes[o + 4], pipes[o + 3]));
      mesh.setMatrixAt(k, m4);
      data[k * 2] = pipes[o + 6]; data[k * 2 + 1] = 2;
    }
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 2));
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  const neonMaterial =new THREE.ShaderMaterial({ vertexShader: NEON_VERT, fragmentShader: NEON_FRAG, uniforms: su() });
  {
    const n = neons.length / 10;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const col = new Float32Array(n * 3), sd = new Float32Array(n);
    const mesh = new THREE.InstancedMesh(geo, neonMaterial, n);
    for (let k = 0; k < n; k++) {
      const o = k * 10;
      m4.compose(v.set(neons[o], neons[o + 1], neons[o + 2]), q.identity(), sc.set(neons[o + 3], neons[o + 4], neons[o + 5]));
      mesh.setMatrixAt(k, m4);
      col.set([neons[o + 6], neons[o + 7], neons[o + 8]], k * 3); sd[k] = neons[o + 9];
    }
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1));
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  {
    const n = signs.length / 10;
    const geo = new THREE.PlaneGeometry(1, 1);
    const col = new Float32Array(n * 3), sg = new Float32Array(n * 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SIGN_VERT, fragmentShader: SIGN_FRAG, uniforms: su({ uAtlas: { value: typeof document !== 'undefined' ? buildSignAtlas() : null } }),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    for (let k = 0; k < n; k++) {
      const o = k * 10;
      m4.compose(v.set(signs[o], signs[o + 1], signs[o + 2]), q.setFromEuler(eu.set(0, signs[o + 4], 0)), sc.set(signs[o + 3], signs[o + 3] / 4, 1));
      mesh.setMatrixAt(k, m4);
      col.set([signs[o + 5], signs[o + 6], signs[o + 7]], k * 3);
      sg[k * 2] = signs[o + 8]; sg[k * 2 + 1] = signs[o + 9];
    }
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.setAttribute('aSign', new THREE.InstancedBufferAttribute(sg, 2));
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span),
    new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: su() })
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // ---- collision: spatial hash of AABBs (inserted with padding so one cell lookup is enough)
  const hashMap = new Map();
  const PAD = 2.5;
  const key = (cx, cz) => (cx + 64) * 256 + (cz + 64);
  for (const c of colliders) {
    const x0 = Math.floor((c.minX - PAD) / CELL), x1 = Math.floor((c.maxX + PAD) / CELL);
    const z0 = Math.floor((c.minZ - PAD) / CELL), z1 = Math.floor((c.maxZ + PAD) / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = key(x, z);
      if (!hashMap.has(k)) hashMap.set(k, []);
      hashMap.get(k).push(c);
    }
  }
  const EMPTY = [];
  const near = (x, z) => hashMap.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || EMPTY;
  const pointBlocked = (x, y, z, pad = 0) => {
    for (const c of near(x, z)) {
      if (x > c.minX - pad && x < c.maxX + pad && y > c.minY - pad && y < c.maxY + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  };

  return {
    group, shared, grid, terminals, near, holoSpots, ventSpots,
    // drop anything that ended up overlapping geometry (walkways, rooftop tanks)
    shards: shards.filter(([x, y, z]) => !pointBlocked(x, y, z, 0.6)),
    beaconSpots: beaconSpots.filter(([x, y, z]) => !pointBlocked(x, y, z, 1.5)),
    powerSpots: powerSpots.filter(([x, y, z]) => !pointBlocked(x, y, z, 1.2)), pointBlocked, neonMaterial, districtColor, fogColor,
    stats: { boxes: boxes.length / 8, pipes: pipes.length / 7, neons: neons.length / 10, signs: signs.length / 10, shards: shards.length },
  };
}
