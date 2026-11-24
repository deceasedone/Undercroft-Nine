// Things that live in the city: data nodes, sentinels, searchlights, the Lantern core, sky traffic, drizzle.
import * as THREE from 'three';
import { CEIL, HALF, N, MID, START_CELL, cellCenter, NEON } from './cityGen.js';
import { glowCloud } from './pickups.js';

const hdr = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const additive = (color, opacity) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });

const BEAM_VERT = /* glsl */ `
varying vec2 vUv; varying float vY;
void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const BEAM_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
varying vec2 vUv; varying float vY;
void main(){
  float bands = 0.55 + 0.45 * smoothstep(0.6, 1.0, sin(vY * 1.4 - uTime * 6.0));
  float fade = smoothstep(55.0, 5.0, vY);
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  gl_FragColor = vec4(uColor * bands * fade * (0.5 + 0.5 * edge) * uAlpha, 1.0);
}`;

export function createTerminals(scene, defs) {
  const bodyGeo = new THREE.BoxGeometry(1.3, 2.1, 0.9);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x121722 });
  const capGeo = new THREE.BoxGeometry(1.5, 0.18, 1.1);
  const ventGeo = new THREE.BoxGeometry(0.9, 0.05, 0.02);
  const screenGeo = new THREE.PlaneGeometry(1.0, 0.7);
  const gemGeo = new THREE.OctahedronGeometry(0.75);
  const gemInnerGeo = new THREE.OctahedronGeometry(0.32);
  const haloGeo = new THREE.TorusGeometry(1.3, 0.05, 6, 40);
  const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 56, 10, 1, true);
  const ringGeo = new THREE.RingGeometry(0.94, 1.0, 48);
  const LIVE = hdr(1.3, 0.95, 0.14), DONE = hdr(0.06, 0.65, 0.38);
  const glow = glowCloud(scene, Math.max(1, defs.length));

  return defs.map((d, index) => {
    const g = new THREE.Group();
    g.position.set(d.x, 0, d.z); g.rotation.y = d.rot;
    const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = 1.05; g.add(body);
    const cap = new THREE.Mesh(capGeo, bodyMat); cap.position.y = 2.2; g.add(cap);
    const glowMat = new THREE.MeshBasicMaterial({ color: LIVE.clone() });
    for (const sg of [1, -1]) {
      const screen = new THREE.Mesh(screenGeo, glowMat);
      screen.position.set(0, 1.5, sg * 0.46); if (sg < 0) screen.rotation.y = Math.PI;
      g.add(screen);
      for (let k = 0; k < 3; k++) {
        const vent = new THREE.Mesh(ventGeo, glowMat);
        vent.position.set(0, 0.45 + k * 0.14, sg * 0.46); g.add(vent);
      }
    }
    const holo = new THREE.Group(); holo.position.y = 4.2; g.add(holo);
    const gem = new THREE.Mesh(gemGeo, new THREE.MeshBasicMaterial({ color: LIVE.clone(), wireframe: true })); holo.add(gem);
    const inner = new THREE.Mesh(gemInnerGeo, new THREE.MeshBasicMaterial({ color: LIVE.clone() })); holo.add(inner);
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: LIVE.clone().multiplyScalar(0.7) })); halo.rotation.x = Math.PI / 2; holo.add(halo);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: LIVE.clone() }, uAlpha: { value: 0.5 } },
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = 28; g.add(beam);
    const rings = [0, 1, 2].map((k) => {
      const m = additive(LIVE.clone(), 0.5);
      const r = new THREE.Mesh(ringGeo, m); r.rotation.x = -Math.PI / 2; r.position.y = 0.08; r.userData.off = k / 3; g.add(r); return r;
    });
    glow.color(index, [1.0, 0.72, 0.12]);
    scene.add(g);
    const term = {
      index, x: d.x, z: d.z, collected: false, group: g,
      update(t) {
        holo.rotation.y = t * 1.4 + index; holo.position.y = 4.2 + Math.sin(t * 2 + index) * 0.3;
        inner.rotation.x = t * 2.1; halo.rotation.y = Math.sin(t + index) * 0.4;
        beamMat.uniforms.uTime.value = t;
        if (!term.collected) {
          for (const r of rings) {
            const f = (t * 0.5 + r.userData.off) % 1;
            r.scale.setScalar(1 + f * 9); r.material.opacity = 0.5 * (1 - f) * (1 - f);
          }
          glow.set(index, d.x, holo.position.y, d.z, 7 + Math.sin(t * 3 + index) * 1.5, 0.9);
        } else glow.set(index, d.x, holo.position.y, d.z, 2.5, 0.3);
        glow.commit();
      },
      collect() {
        term.collected = true;
        glowMat.color.copy(DONE); gem.material.color.copy(DONE); inner.material.color.copy(DONE); halo.material.color.copy(DONE);
        beamMat.uniforms.uColor.value.copy(DONE); beamMat.uniforms.uAlpha.value = 0.12;
        glow.color(index, [0.05, 0.6, 0.35]);
        for (const r of rings) r.visible = false;
      },
    };
    return term;
  });
}

// Patrol the street grid. Once they see the drone they hunt it, paint it with an aiming laser and fire.
export function createSentinels(scene, rnd, count, cfg) {
  const sight = cfg.sight;
  const nodes = [];
  for (let a = 0; a < N; a += 3) for (let b = 0; b < N; b += 3) {
    if (a === MID && b === MID) continue;
    if (a === START_CELL[0] && b === START_CELL[1]) continue;
    nodes.push([a, b]);
  }
  const ok = (a, b) => nodes.some((n) => n[0] === a && n[1] === b);
  const DIRS = [[3, 0], [-3, 0], [0, 3], [0, -3]];
  const nodePos = (n) => [cellCenter(n[0]), cellCenter(n[1])];

  const coreGeo = new THREE.OctahedronGeometry(0.7);
  const cageGeo = new THREE.TorusGeometry(1.4, 0.05, 6, 32);
  const hullGeo = new THREE.CylinderGeometry(0.95, 1.15, 0.45, 8);
  const finGeo = new THREE.BoxGeometry(0.16, 0.12, 1.0);
  const lensGeo = new THREE.CylinderGeometry(0.26, 0.36, 0.45, 10);
  const pupilGeo = new THREE.CircleGeometry(0.2, 12);
  const laserGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true);
  laserGeo.translate(0, 0.5, 0); laserGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(sight - 0.3, sight, 72);
  const coneGeo = new THREE.ConeGeometry(sight, 1, 40, 1, true);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0x1b1e28 });
  const PATROL = hdr(1.0, 0.36, 0.06), HUNT = hdr(1.4, 0.06, 0.05), STUN = hdr(0.25, 0.55, 1.2);

  const out = [];
  function make(node, drop) {
    const k = out.length;
    const g = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: PATROL.clone() });
    const cageMat = new THREE.MeshBasicMaterial({ color: PATROL.clone().multiplyScalar(0.55) });
    g.add(new THREE.Mesh(hullGeo, shellMat));
    const core = new THREE.Mesh(coreGeo, coreMat); core.position.y = 0.55; g.add(core);
    const cage = new THREE.Group();
    const cA = new THREE.Mesh(cageGeo, cageMat), cB = new THREE.Mesh(cageGeo, cageMat);
    cB.rotation.y = Math.PI / 2; cage.add(cA, cB); cage.position.y = 0.3; g.add(cage);
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = new THREE.Mesh(finGeo, shellMat);
      fin.position.set(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15); fin.rotation.y = -a + Math.PI / 2;
      g.add(fin);
    }
    const eye = new THREE.Group(); eye.position.y = -0.4;
    const lens = new THREE.Mesh(lensGeo, shellMat); lens.rotation.x = Math.PI / 2; eye.add(lens);
    const pupil = new THREE.Mesh(pupilGeo, coreMat); pupil.position.z = 0.24; eye.add(pupil);
    const laserMat = additive(hdr(1.6, 0.1, 0.06), 0);
    const laser = new THREE.Mesh(laserGeo, laserMat); eye.add(laser);
    g.add(eye);
    const ringMat = additive(PATROL.clone(), 0.3);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; g.add(ring);
    const coneMat = additive(PATROL.clone(), 0.02);
    const cone = new THREE.Mesh(coneGeo, coneMat); g.add(cone);
    const [sx0, sz0] = nodePos(node);
    g.position.set(sx0, drop ? CEIL - 6 : 7, sz0);
    scene.add(g);

    const tmpC = new THREE.Color(), eyeW = new THREE.Vector3();
    const s = {
      pos: g.position, from: node, to: node, a: 1, alert: 0, hunt: 0, aim: 0, cool: 1 + Math.random(), stun: 0,
      dropping: !!drop, aimFrac: 0,
      eyePos() { return eye.getWorldPosition(eyeW); },
      spot(player) {
        if (s.hunt <= 0 && s.a < 1) {
          const [fx, fz] = nodePos(s.from), [tx, tz] = nodePos(s.to);
          if (Math.hypot(tx - player.x, tz - player.z) > Math.hypot(fx - player.x, fz - player.z)) {
            [s.from, s.to] = [s.to, s.from]; s.a = 1 - s.a;
          }
        }
        s.hunt = 3.5;
      },
      calm() { s.hunt = 0; s.alert = 0; s.aim = 0; },
      update(dt, t, player, speedMul = 1) {
        let baseY = 7 + Math.sin(t * 1.3 + k) * 0.4;
        if (s.stun > 0) {
          s.stun -= dt; s.aim = 0; s.hunt = 0;
          g.position.y += (3.2 - g.position.y) * Math.min(1, dt * 3);
          cage.rotation.y += dt * 9; core.rotation.x = Math.sin(t * 30) * 0.4;
          tmpC.copy(STUN).multiplyScalar(0.5 + 0.5 * Math.sin(t * 25));
          coreMat.color.copy(tmpC); cageMat.color.copy(tmpC).multiplyScalar(0.5);
          ringMat.opacity = 0.05; coneMat.opacity = 0; laserMat.opacity = 0;
          ring.position.y = -g.position.y + 0.08;
          return;
        }
        if (s.dropping) {
          g.position.y += (baseY - g.position.y) * Math.min(1, dt * 1.5);
          if (Math.abs(g.position.y - baseY) < 0.3) s.dropping = false;
        }
        const hunting = s.hunt > 0 && player;
        if (s.hunt > 0) s.hunt -= dt;
        s.a += (dt * (hunting ? cfg.huntSpeed : cfg.speed) * speedMul) / 48;
        if (s.a >= 1) {
          s.a = 0; const cur = s.to;
          let opts = DIRS.map(([da, db]) => [cur[0] + da, cur[1] + db]).filter(([a, b]) => ok(a, b));
          let pick;
          if (hunting) {
            let best = Infinity;
            for (const o of opts) {
              const [ox, oz] = nodePos(o), d = Math.hypot(ox - player.x, oz - player.z);
              if (d < best) { best = d; pick = o; }
            }
          } else {
            const fresh = opts.filter(([a, b]) => !(a === s.from[0] && b === s.from[1]));
            if (fresh.length) opts = fresh;
            pick = opts[Math.floor(Math.random() * opts.length)];
          }
          s.from = cur; s.to = pick || cur;
        }
        const [fx, fz] = nodePos(s.from), [tx, tz] = nodePos(s.to);
        g.position.x = fx + (tx - fx) * s.a;
        g.position.z = fz + (tz - fz) * s.a;
        if (!s.dropping) g.position.y += (baseY - g.position.y) * Math.min(1, dt * 3);
        ring.position.y = -g.position.y + 0.08;
        cone.position.y = -g.position.y / 2; cone.scale.y = g.position.y;

        const heat = Math.max(s.alert, hunting ? 0.75 : 0);
        tmpC.copy(PATROL).lerp(HUNT, heat);
        coreMat.color.copy(tmpC); cageMat.color.copy(tmpC).multiplyScalar(0.55);
        ringMat.color.copy(tmpC); coneMat.color.copy(tmpC);
        core.rotation.y = t * 2;
        cage.rotation.y += dt * (0.8 + heat * 5); cage.rotation.x = Math.sin(t * 0.7 + k) * 0.5;
        const pulse = 0.5 + 0.5 * Math.sin(t * (4 + heat * 12));
        ringMat.opacity = 0.16 + 0.12 * pulse + heat * 0.22;
        coneMat.opacity = 0.012 + heat * 0.02;
        if (player && heat > 0.05) {
          eye.lookAt(player);
          laser.scale.z = g.position.distanceTo(player);
          const blink = s.aimFrac > 0.7 ? (Math.sin(t * 60) > 0 ? 1 : 0.3) : 1;
          laserMat.opacity = Math.min(0.85, s.aimFrac * 0.75) * blink;
        } else {
          eye.rotation.set(0.5, t * 0.9 + k, 0);
          laserMat.opacity = 0;
        }
      },
    };
    out.push(s);
    return s;
  }

  for (let k = 0; k < count; k++) {
    let node, tries = 0;
    do { node = nodes[Math.floor(rnd() * nodes.length)]; tries++; }
    while (Math.hypot(node[0] - START_CELL[0], node[1] - START_CELL[1]) < 6 && tries < 50);
    make(node, false);
  }
  out.spawn = (x, z) => {
    let best = nodes[0], bd = Infinity;
    for (const n of nodes) {
      const [nx, nz] = nodePos(n), d = Math.abs(Math.hypot(nx - x, nz - z) - 60);
      if (d < bd) { bd = d; best = n; }
    }
    return make(best, true);
  };
  return out;
}

export function createWatchers(scene, rnd, count, cfg) {
  const R = cfg.watcherRadius, H = CEIL - 3;
  const coneGeo = new THREE.CylinderGeometry(0.8, R, H, 36, 1, true); coneGeo.translate(0, H / 2, 0);
  const ringGeo = new THREE.RingGeometry(R - 0.35, R, 64);
  const discGeo = new THREE.CircleGeometry(R, 48);
  const lampGeo = new THREE.CylinderGeometry(1.0, 1.4, 1.2, 10);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x1b1e28 });
  const COLD = hdr(0.55, 0.7, 0.95), ALERT = hdr(1.3, 0.12, 0.08);
  const out = [];
  for (let k = 0; k < count; k++) {
    const ax = (0.45 + rnd() * 0.4) * HALF, az = (0.45 + rnd() * 0.4) * HALF;
    const w1 = (cfg.watcherSpeed / ax) * (0.6 + rnd() * 0.5), w2 = (cfg.watcherSpeed / az) * (0.6 + rnd() * 0.5);
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28;
    const g = new THREE.Group();
    const coneMat = additive(COLD.clone(), 0.04);
    g.add(new THREE.Mesh(coneGeo, coneMat));
    const ringMat = additive(COLD.clone(), 0.35);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
    const discMat = additive(COLD.clone(), 0.05);
    const disc = new THREE.Mesh(discGeo, discMat); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.09; g.add(disc);
    const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.y = H; g.add(lamp);
    const lensMat = new THREE.MeshBasicMaterial({ color: COLD.clone() });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), lensMat); lens.rotation.x = Math.PI / 2; lens.position.y = H - 0.62; g.add(lens);
    scene.add(g);
    const tmpC = new THREE.Color();
    let clock = 0;
    const w = {
      pos: g.position, radius: R, alert: 0, stun: 0,
      update(dt, t, speedMul = 1) {
        if (w.stun > 0) { w.stun -= dt; coneMat.opacity = 0.01; ringMat.opacity = 0.08; discMat.opacity = 0.01; return; }
        clock += dt * speedMul;
        g.position.x = ax * Math.sin(w1 * clock + p1);
        g.position.z = az * Math.sin(w2 * clock + p2);
        tmpC.copy(COLD).lerp(ALERT, w.alert);
        coneMat.color.copy(tmpC); ringMat.color.copy(tmpC); discMat.color.copy(tmpC); lensMat.color.copy(tmpC);
        coneMat.opacity = 0.035 + w.alert * 0.05;
        ringMat.opacity = 0.3 + w.alert * 0.3 + 0.08 * Math.sin(t * 3 + k);
        discMat.opacity = 0.04 + w.alert * 0.06;
      },
    };
    out.push(w);
  }
  return out;
}

export function createCore(scene) {
  const g = new THREE.Group(); g.position.set(0, 16, 0);
  const DORMANT = hdr(0.6, 0.06, 0.42), AWAKE = hdr(0.3, 1.05, 1.3);
  const wire = new THREE.MeshBasicMaterial({ color: DORMANT.clone(), wireframe: true });
  const solid = new THREE.MeshBasicMaterial({ color: DORMANT.clone().multiplyScalar(0.6) });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), wire); g.add(shell);
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(2.2), solid); g.add(heart);
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(6.6 + k * 0.9, 0.07, 6, 72), wire);
    g.add(r); rings.push(r);
  }
  const beamMat = additive(AWAKE.clone(), 0.0);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, CEIL, 16, 1, true), beamMat);
  beam.position.y = CEIL / 2 - 16; g.add(beam);
  const haloMat = additive(AWAKE.clone(), 0.0);
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, CEIL, 16, 1, true), haloMat);
  halo.position.copy(beam.position); g.add(halo);
  const shieldMat = new THREE.MeshBasicMaterial({ color: hdr(1.0, 0.12, 0.08), wireframe: true, transparent: true, opacity: 0 });
  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 2), shieldMat); g.add(shield);
  scene.add(g);
  const core = {
    pos: g.position, active: false, glow: 0, shielded: false,
    activate() { core.active = true; wire.color.copy(AWAKE); solid.color.copy(AWAKE).multiplyScalar(0.8); },
    setShield(on) { core.shielded = on; },
    update(dt, t) {
      const sp = core.active ? 2.2 : 0.5;
      shell.rotation.y += dt * 0.25 * sp; shell.rotation.x += dt * 0.11 * sp;
      heart.rotation.y -= dt * 0.9 * sp; heart.scale.setScalar(1 + 0.12 * Math.sin(t * (core.active ? 5 : 1.4)));
      rings.forEach((r, k) => { r.rotation.x = t * 0.3 * sp * (k + 1) * 0.6 + k; r.rotation.y = t * 0.2 * sp + k * 2; });
      shield.rotation.y = t * 0.3;
      shieldMat.opacity += ((core.shielded ? 0.35 + 0.1 * Math.sin(t * 6) : 0) - shieldMat.opacity) * Math.min(1, dt * 3);
      shield.visible = shieldMat.opacity > 0.01;
      if (core.active) {
        core.glow = Math.min(1, core.glow + dt * 0.6);
        beamMat.opacity = core.glow * (0.2 + 0.05 * Math.sin(t * 9));
        haloMat.opacity = core.glow * 0.06;
      }
    },
  };
  return core;
}

export function createTraffic(scene, neonMaterial, rnd, count = 46) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const col = new Float32Array(count * 3), sd = new Float32Array(count);
  const mesh = new THREE.InstancedMesh(geo, neonMaterial, count);
  const cars = [];
  for (let k = 0; k < count; k++) {
    const dir = rnd() < 0.5 ? 1 : -1;
    const c = dir > 0 ? NEON.white : NEON.red;
    col.set([c[0] * 0.6, c[1] * 0.6, c[2] * 0.6], k * 3); sd[k] = rnd() * 0.5;
    cars.push({ axis: rnd() < 0.5 ? 0 : 1, line: cellCenter(Math.floor(rnd() * 7) * 3) + dir * 2.5, y: 40 + rnd() * 32, speed: dir * (16 + rnd() * 26), p: (rnd() * 2 - 1) * HALF });
  }
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1));
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const m4 = new THREE.Matrix4();
  return {
    update(dt) {
      for (let k = 0; k < count; k++) {
        const c = cars[k];
        c.p += c.speed * dt;
        if (c.p > HALF) c.p -= HALF * 2; else if (c.p < -HALF) c.p += HALF * 2;
        if (c.axis === 0) m4.makeScale(0.35, 0.18, 4.5).setPosition(c.line, c.y, c.p);
        else m4.makeScale(4.5, 0.18, 0.35).setPosition(c.p, c.y, c.line);
        mesh.setMatrixAt(k, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export function createRain(scene, shared, count = 3500) {
  const pos = new Float32Array(count * 6), end = new Float32Array(count * 2);
  for (let k = 0; k < count; k++) {
    const x = Math.random() * 90, y = Math.random() * 60, z = Math.random() * 90;
    pos.set([x, y, z, x, y, z], k * 6); end[k * 2] = 0; end[k * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime },
    vertexShader: /* glsl */ `
      uniform float uTime; attribute float aEnd; varying float vA;
      void main(){
        vec3 p = position;
        p.y -= uTime * (30.0 + 14.0*fract(p.x*7.31));
        vec3 box = vec3(90.0, 60.0, 90.0);
        p = mod(p - cameraPosition, box) - box*0.5 + cameraPosition;
        p.y += aEnd * 0.9;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vA = (1.0 - smoothstep(18.0, 44.0, -mv.z)) * step(0.0, p.y) * (0.4 + 0.6*aEnd);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ gl_FragColor = vec4(vec3(0.45,0.65,0.9) * vA * 0.26, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);
  return lines;
}
