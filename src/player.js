// The salvage drone: model, flight model (boost energy, dash, altitude hold, wall bounce) and chase camera.
import * as THREE from 'three';
import { CEIL, HALF } from './cityGen.js';

// Collision sphere radius — matches the furthest point of the rotor ducts so the hull never sinks into walls.
export const DRONE_RADIUS = 1.6;
const hdr = (r, g, b) => new THREE.Color().setRGB(r, g, b);

function buildDroneMesh() {
  const g = new THREE.Group();
  const mats = [];
  const M = (color, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, ...extra }); mats.push(m); return m; };
  const hull = M(0x1a2130), hullLight = M(0x2a3346), trim = M(0x0b0e15), glass = M(0x0a1220);
  const cyan = M(hdr(0.15, 0.95, 1.2)), mag = M(hdr(1.2, 0.15, 0.85)), red = M(hdr(1.3, 0.08, 0.05));
  const lights = [cyan, mag, red];
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
  };

  add(new THREE.BoxGeometry(0.72, 0.26, 1.25), hull);
  add(new THREE.BoxGeometry(0.56, 0.1, 1.05), hullLight, 0, 0.17, 0.05);
  add(new THREE.BoxGeometry(0.8, 0.08, 0.9), trim, 0, -0.16, 0.05);
  const noseGeo = new THREE.CylinderGeometry(0, 0.37, 0.72, 4); noseGeo.rotateY(Math.PI / 4); noseGeo.scale(1, 1, 0.55);
  add(noseGeo, hull, 0, 0, -0.98, -Math.PI / 2);
  const canopy = add(new THREE.SphereGeometry(0.3, 16, 10), glass, 0, 0.2, -0.22); canopy.scale.set(0.95, 0.55, 1.7);
  add(new THREE.BoxGeometry(0.42, 0.035, 0.03), cyan, 0, 0.22, -0.72);
  add(new THREE.BoxGeometry(0.035, 0.03, 0.95), cyan, 0, 0.23, 0.15);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.05, 1.0), mag, s * 0.37, 0.02, 0.05);
  add(new THREE.CylinderGeometry(0.2, 0.25, 0.36, 12), trim, 0, 0, 0.74, Math.PI / 2);
  add(new THREE.TorusGeometry(0.21, 0.05, 8, 24), hullLight, 0, 0, 0.92);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.05, 0.03, 0.14), trim, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.9, 0, 0, a);
  }
  const coreMat = new THREE.MeshBasicMaterial({ color: hdr(0.45, 0.85, 1.15), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const engineCore = add(new THREE.CircleGeometry(0.17, 24), coreMat, 0, 0, 0.935);
  // flame cones: uv.y runs 0 at the nozzle to 1 at the tip, so the flame fades out along its length
  const flame = (color) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uBase: { value: color.clone() }, uTime: { value: 0 }, uPower: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uPower; varying vec2 vUv;
      void main(){
        float fade = pow(1.0 - vUv.y, 1.7);
        float flick = 0.82 + 0.18 * sin(uTime * 63.0 + vUv.x * 31.4) * sin(uTime * 41.0);
        float bands = 0.8 + 0.2 * sin(vUv.y * 22.0 - uTime * 45.0);
        gl_FragColor = vec4(uColor * fade * flick * bands * uPower, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const plume = new THREE.Group(); plume.position.z = 0.93; plume.rotation.x = Math.PI / 2; g.add(plume);
  const outerGeo = new THREE.ConeGeometry(0.2, 1, 18, 1, true); outerGeo.translate(0, 0.5, 0);
  const innerGeo = new THREE.ConeGeometry(0.1, 0.65, 14, 1, true); innerGeo.translate(0, 0.325, 0);
  const flames = [flame(hdr(0.1, 0.42, 0.9)), flame(hdr(0.55, 0.85, 1.15))];
  plume.add(new THREE.Mesh(outerGeo, flames[0]), new THREE.Mesh(innerGeo, flames[1]));
  const boostCols = [hdr(0.5, 0.2, 1.05), hdr(1.05, 0.85, 1.2)];
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.32, 0.38), hull, s * 0.22, 0.22, 0.58, 0, 0, s * 0.35);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.05), red, s * 0.27, 0.36, 0.72);
  }

  const pods = [];
  const ductGeo = new THREE.TorusGeometry(0.4, 0.055, 6, 22);
  const bladeGeo = new THREE.BoxGeometry(0.7, 0.012, 0.06);
  const hubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8);
  const discGeo = new THREE.CircleGeometry(0.37, 18);
  const discMat = new THREE.MeshBasicMaterial({ color: hdr(0.2, 0.6, 0.8), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const armGeo = new THREE.BoxGeometry(0.08, 0.06, 0.62);
  for (const [sx, sz] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
    const px = sx * 0.85, pz = sz * 0.78;
    const arm = add(armGeo, hullLight, px * 0.55, 0, pz * 0.55, 0, Math.atan2(px, pz), 0);
    arm.scale.z = 1.05;
    const pod = new THREE.Group(); pod.position.set(px, 0.04, pz); g.add(pod);
    const duct = new THREE.Mesh(ductGeo, hull); duct.rotation.x = Math.PI / 2; pod.add(duct);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.018, 4, 22), sz < 0 ? cyan : mag); ring.rotation.x = Math.PI / 2; ring.position.y = 0.045; pod.add(ring);
    const hub = new THREE.Mesh(hubGeo, trim); pod.add(hub);
    const blades = new THREE.Group(); pod.add(blades);
    const b1 = new THREE.Mesh(bladeGeo, trim), b2 = new THREE.Mesh(bladeGeo, trim); b2.rotation.y = Math.PI / 2; blades.add(b1, b2);
    const disc = new THREE.Mesh(discGeo, discMat); disc.rotation.x = -Math.PI / 2; pod.add(disc);
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), sz < 0 ? cyan : red); nav.position.set(sx * 0.42, 0, 0); pod.add(nav);
    pods.push({ group: pod, blades });
  }
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshBasicMaterial({ color: hdr(0.1, 0.65, 0.85), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = -0.22; g.add(under);
  const coneGeo = new THREE.ConeGeometry(1.7, 7, 18, 1, true);
  const head = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: hdr(0.5, 0.8, 1.0), transparent: true, opacity: 0.01, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  head.rotation.x = Math.PI / 2; head.position.z = -4.6; g.add(head);

  g.userData = { pods, plume, flames, boostCols, engineCore, coreMat, boostK: 0, under, lights, lightBase: lights.map((m) => m.color.clone()), mats };
  return g;
}

export class Drone {
  constructor(scene, camera) {
    this.camera = camera; this.world = null;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.boosting = false; this.speed = 0;
    this.energy = 100; this.energyDelay = 0; this.boostLock = false;
    this.dashCD = 0; this.dashT = 0; this.fovKick = 0; this.shake = 0;
    this.lowHp = 0; this.cloaked = false; this.onImpact = null;
    this.mesh = buildDroneMesh(); this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);
    this._fwd = new THREE.Vector3(); this._right = new THREE.Vector3(); this._acc = new THREE.Vector3();
    this._cam = new THREE.Vector3(); this._look = new THREE.Vector3(); this._n = new THREE.Vector3(); this._tmp = new THREE.Vector3();
    this.camInit = false;
    this._lastAxes = { fwd: 0, strafe: 0, up: 0 };
  }

  place(x, y, z, yaw = 0) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0; this.camInit = false;
    this.energy = 100; this.boostLock = false; this.dashCD = 0; this.dashT = 0;
  }

  dirs() {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this._fwd.set(-sy * cp, sp, -cy * cp); this._right.set(cy, 0, -sy);
    return [this._fwd, this._right];
  }

  // quick burst in the input direction with a short window of invulnerability
  dash() {
    if (this.dashCD > 0) return false;
    const [fwd, right] = this.dirs(), a = this._lastAxes;
    const d = this._tmp.set(0, 0, 0).addScaledVector(fwd, a.fwd).addScaledVector(right, a.strafe);
    d.y += a.up;
    if (d.lengthSq() < 0.01) d.copy(fwd);
    d.normalize();
    this.vel.addScaledVector(d, 32);
    this.dashCD = 1.4; this.dashT = 0.32; this.fovKick = 1;
    return true;
  }

  setCloak(on) {
    if (this.cloaked === on) return;
    this.cloaked = on;
    for (const m of this.mesh.userData.mats) m.opacity = on ? 0.22 : 1;
  }

  podWorld(i, out) { return this.mesh.userData.pods[i].group.getWorldPosition(out); }

  collide() {
    const p = this.pos, v = this.vel, R = DRONE_RADIUS;
    let impact = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.world.near(p.x, p.z)) {
        const qx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const qy = Math.max(c.minY, Math.min(p.y, c.maxY));
        const qz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        let dx = p.x - qx, dy = p.y - qy, dz = p.z - qz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = R - d;
          dx /= d; dy /= d; dz /= d;
        } else {
          // centre inside the box: leave through the nearest face
          const pen = [p.x - c.minX, c.maxX - p.x, p.y - c.minY, c.maxY - p.y, p.z - c.minZ, c.maxZ - p.z];
          let m = 0; for (let k = 1; k < 6; k++) if (pen[k] < pen[m]) m = k;
          dx = m === 0 ? -1 : m === 1 ? 1 : 0; dy = m === 2 ? -1 : m === 3 ? 1 : 0; dz = m === 4 ? -1 : m === 5 ? 1 : 0;
          if (m === 0) p.x = c.minX - R; else if (m === 1) p.x = c.maxX + R;
          else if (m === 2) p.y = c.minY - R; else if (m === 3) p.y = c.maxY + R;
          else if (m === 4) p.z = c.minZ - R; else p.z = c.maxZ + R;
        }
        if (d2 > 1e-8) {
          const push = R - Math.sqrt(d2);
          p.x += dx * push; p.y += dy * push; p.z += dz * push;
        }
        const vn = v.x * dx + v.y * dy + v.z * dz;
        if (vn < 0) {
          const k = vn < -8 ? 1.45 : 1; // hard hits bounce, gentle ones slide
          v.x -= k * vn * dx; v.y -= k * vn * dy; v.z -= k * vn * dz;
          if (-vn > impact) { impact = -vn; this._n.set(dx, dy, dz); }
        }
      }
    }
    const lim = HALF - R;
    p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z));
    const floor = R + 0.2;
    if (p.y < floor) {
      p.y = floor;
      if (v.y < -8) { if (-v.y > impact) { impact = -v.y; this._n.set(0, 1, 0); } v.y = -v.y * 0.4; } else v.y = Math.max(v.y, 0);
    }
    if (p.y > CEIL - 8) { p.y = CEIL - 8; v.y = Math.min(v.y, 0); }
    return impact;
  }

  update(dt, t, frozen, input) {
    const look = input ? input.look(dt) : { yaw: 0, pitch: 0 };
    if (!frozen) {
      this.yaw += look.yaw;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + look.pitch));
    }
    const [fwd, right] = this.dirs();
    const ax = !frozen && input ? input.axes() : { fwd: 0, strafe: 0, up: 0, boost: false };
    this._lastAxes = ax;
    const acc = this._acc.set(0, 0, 0).addScaledVector(fwd, ax.fwd).addScaledVector(right, ax.strafe);
    acc.y += ax.up;
    const moving = acc.lengthSq() > 0.01;
    if (acc.lengthSq() > 1) acc.normalize();

    this.boosting = false;
    if (ax.boost && moving && this.energy > 0 && !this.boostLock) {
      this.boosting = true; this.energy -= 30 * dt; this.energyDelay = 0.7;
      if (this.energy <= 0) { this.energy = 0; this.boostLock = true; }
    } else {
      this.energyDelay -= dt;
      if (this.energyDelay <= 0) this.energy = Math.min(100, this.energy + 24 * dt);
      if (this.boostLock && this.energy > 25) this.boostLock = false;
    }
    acc.multiplyScalar(this.boosting ? 175 : 100);
    this.vel.addScaledVector(acc, dt);
    // snappy drag: quick stop horizontally, firm altitude hold vertically
    const kh = Math.exp(-3.8 * dt), kv = Math.exp(-5.5 * dt);
    this.vel.x *= kh; this.vel.z *= kh; this.vel.y *= kv;

    const steps = Math.max(1, Math.ceil((this.vel.length() * dt) / 0.5));
    let impact = 0;
    for (let s = 0; s < steps; s++) { this.pos.addScaledVector(this.vel, dt / steps); impact = Math.max(impact, this.collide()); }
    if (impact > 9 && this.onImpact) this.onImpact(impact, this._n, this.pos);
    this.speed = this.vel.length();
    this.dashCD = Math.max(0, this.dashCD - dt); this.dashT = Math.max(0, this.dashT - dt);
    this.fovKick = Math.max(0, this.fovKick - dt * 3);

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const vf = this.vel.x * -sy + this.vel.z * -cy, vr = this.vel.dot(right);
    const m = this.mesh, U = m.userData, k = 1 - Math.exp(-9 * dt);
    m.position.copy(this.pos); m.position.y += Math.sin(t * 2.3) * 0.07;
    m.rotation.y = this.yaw;
    m.rotation.x += (Math.max(-0.5, Math.min(0.5, -vf * 0.012)) + this.pitch * 0.2 - m.rotation.x) * k;
    m.rotation.z += (Math.max(-0.6, Math.min(0.6, -vr * 0.022)) - m.rotation.z) * k;
    const tiltX = Math.max(-0.45, Math.min(0.45, -vf * 0.016)), tiltZ = Math.max(-0.45, Math.min(0.45, -vr * 0.016));
    for (const p of U.pods) {
      p.group.rotation.x += (tiltX - p.group.rotation.x) * k;
      p.group.rotation.z += (tiltZ - p.group.rotation.z) * k;
      p.blades.rotation.y = t * (40 + this.speed * 1.5) + p.group.position.x * 3;
    }
    // exhaust stretches with speed, flares and shifts toward violet-white on boost and dash
    const speedK = Math.min(1, this.speed / 46);
    U.boostK += ((this.boosting ? 1 : 0) + this.fovKick * 0.8 - U.boostK) * Math.min(1, dt * 8);
    const len = 0.3 + speedK * 1.0 + U.boostK * 1.5, wide = 1 + U.boostK * 0.35;
    U.plume.scale.set(wide, U.plume.scale.y + (len - U.plume.scale.y) * Math.min(1, dt * 10), wide);
    const power = this.cloaked ? 0.12 : 0.5 + speedK * 0.4 + U.boostK * 0.6;
    U.flames.forEach((f, i) => {
      f.uniforms.uTime.value = t; f.uniforms.uPower.value = power;
      f.uniforms.uColor.value.copy(f.uniforms.uBase.value).lerp(U.boostCols[i], Math.min(1, U.boostK));
    });
    U.engineCore.scale.setScalar(1 + U.boostK * 0.25 + 0.05 * Math.sin(t * 50));
    U.coreMat.opacity = this.cloaked ? 0.15 : 0.7 + U.boostK * 0.3;
    U.under.material.opacity = (this.cloaked ? 0.05 : 0.22) + Math.min(0.3, this.speed * 0.008) + 0.04 * Math.sin(t * 30);
    const flick = this.lowHp > 0 && Math.random() < this.lowHp * 0.25 ? 0.15 : 1;
    U.lights.forEach((mt, i) => mt.color.copy(U.lightBase[i]).multiplyScalar(flick));

    // chase camera, pulled in when geometry is in the way
    const dist = 6.6 + Math.min(2, this.speed * 0.03);
    const P = this.pos, W = this.world;
    let tx = P.x, ty = P.y + 0.6, tz = P.z;
    const ex = P.x - fwd.x * dist, ey = P.y - fwd.y * dist + 2.1, ez = P.z - fwd.z * dist;
    for (let s = 1; s <= 14; s++) {
      const a = s / 14;
      const x = P.x + (ex - P.x) * a, y = P.y + 0.6 + (ey - P.y - 0.6) * a, z = P.z + (ez - P.z) * a;
      if (W.pointBlocked(x, y, z, 0.6) || y < 0.6 || y > CEIL - 1) break;
      tx = x; ty = y; tz = z;
    }
    this._cam.set(tx, ty, tz);
    if (!this.camInit) { this.camera.position.copy(this._cam); this.camInit = true; }
    else this.camera.position.lerp(this._cam, 1 - Math.exp(-14 * dt));
    if (this.shake > 0) {
      const s = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s; this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this._look.copy(P).addScaledVector(fwd, 7); this._look.y += 1.0;
    this.camera.lookAt(this._look);
    const fov = 70 + (this.boosting ? 12 : 0) + this.fovKick * 14;
    if (Math.abs(this.camera.fov - fov) > 0.1) { this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-6 * dt)); this.camera.updateProjectionMatrix(); }
  }
}
