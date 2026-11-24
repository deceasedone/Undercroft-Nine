// Ambient city detail: flickering hologram adverts and steam rising from street grates.
import * as THREE from 'three';

function buildHoloAtlas() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = (s) => `900 ${s}px "Arial Black", Impact, "Yu Gothic", "Meiryo", sans-serif`;
  g.lineWidth = 6; g.beginPath(); g.arc(130, 128, 80, 0, 7); g.stroke(); g.beginPath(); g.arc(130, 128, 45, 0, 7); g.stroke();
  g.font = font(110); g.fillText('夢', 130, 132);
  g.font = font(64); g.fillText('SOMA', 350, 100); g.font = font(30); g.fillText('SLEEP IS SAFE', 350, 170);
  g.save(); g.translate(512, 0);
  g.lineWidth = 8; g.beginPath(); g.ellipse(256, 110, 200, 70, 0, 0, 7); g.stroke();
  g.beginPath(); g.arc(256, 110, 48, 0, 7); g.fill();
  g.font = font(34); g.fillText('WE SEE YOU SLEEP', 256, 215); g.restore();
  g.save(); g.translate(0, 256);
  g.font = font(78); g.fillText('LANTERN', 256, 90); g.font = font(30); g.fillText('WE KEPT THE LIGHTS ON', 256, 160);
  g.fillRect(56, 200, 400, 6); g.restore();
  g.save(); g.translate(512, 256);
  g.font = font(54); g.fillText('NEURO-LINK', 256, 60);
  for (let k = 0; k < 9; k++) g.fillRect(70 + k * 42, 210 - (30 + ((k * 37) % 90)), 28, 30 + ((k * 37) % 90));
  g.font = font(30); g.fillText('UPTIME 99.99%', 256, 236); g.restore();
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
  return tex;
}

export function createHoloAds(scene, spots, shared, rnd) {
  if (!spots.length || typeof document === 'undefined') return null;
  const n = spots.length;
  const geo = new THREE.PlaneGeometry(1, 0.5);
  const idx = new Float32Array(n), col = new Float32Array(n * 3), seed = new Float32Array(n);
  const PAL = [[0.2, 0.85, 1.0], [1.0, 0.2, 0.75], [1.0, 0.75, 0.2], [0.6, 0.35, 1.0]];
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uAtlas: { value: buildHoloAtlas() }, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity },
    vertexShader: /* glsl */ `
      attribute float aIdx; attribute vec3 aColor; attribute float aSeed;
      varying vec2 vUv; varying float vIdx; varying vec3 vColor; varying float vSeed; varying vec3 vW;
      void main(){ vUv = uv; vIdx = aIdx; vColor = aColor; vSeed = aSeed;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uAtlas; uniform vec3 uFogColor; uniform float uFogDensity;
      varying vec2 vUv; varying float vIdx; varying vec3 vColor; varying float vSeed; varying vec3 vW;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float row = floor(uv.y * 24.0);
        float glitch = step(0.93, h(floor(uTime * 9.0) + row + vSeed * 13.0));
        uv.x += glitch * (h(row + uTime) - 0.5) * 0.12;
        float c = mod(vIdx, 2.0), r = floor(vIdx / 2.0);
        // 2x2 atlas, row 0 is the top half of the canvas
        vec2 a = vec2((c + clamp(uv.x, 0.0, 1.0)) / 2.0, (uv.y + (1.0 - r)) / 2.0);
        float m = texture2D(uAtlas, a).r;
        float scan = 0.65 + 0.35 * sin(vUv.y * 140.0 - uTime * 8.0);
        float flick = 0.75 + 0.25 * sin(uTime * (3.0 + vSeed * 4.0)) * step(0.3, h(floor(uTime * 3.0) + vSeed));
        float frame = step(0.97, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0);
        vec3 col = vColor * (m * 0.85 + frame * 0.35 + 0.03) * scan * flick;
        float d = length(cameraPosition - vW);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * d * d * 0.35);
        gl_FragColor = vec4(col * (1.0 - fog), 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  spots.forEach((sp, i) => {
    m4.compose(v.set(sp.x, sp.y, sp.z), q.setFromEuler(e.set(0, sp.rot, 0)), s.set(sp.w, sp.w, 1));
    mesh.setMatrixAt(i, m4);
    idx[i] = Math.floor(rnd() * 4); col.set(PAL[Math.floor(rnd() * PAL.length)], i * 3); seed[i] = rnd();
  });
  geo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

export function createSteam(fx, spots) {
  let acc = 0;
  return {
    update(dt, cam) {
      acc += dt;
      if (acc < 0.12) return;
      acc = 0;
      for (const [x, z] of spots) {
        if (Math.abs(x - cam.x) > 110 || Math.abs(z - cam.z) > 110) continue;
        fx.spawn(x + (Math.random() - 0.5) * 1.2, 0.3, z + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 0.4, 1.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4,
          [0.13, 0.16, 0.21], 1.1, 2.4, 0.5, 0.5, 2.6);
      }
    },
  };
}
