// Particle effects (sparks, bursts, trails, steam) and the soft glow sprites used by pickups.
import * as THREE from 'three';

// pixel size of one world unit at depth 1 (half the drawing-buffer height * projection scale); main.js keeps it current
export const POINT_SCALE = { value: 400 };

const GLOW_VERT = /* glsl */ `
uniform float uScale;
attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(0.1, -mv.z);
  gl_PointSize = min(256.0, aSize * projectionMatrix[1][1] * uScale / depth);
  vColor = aColor;
  vAlpha = aAlpha * exp(-depth * 0.006);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a = a * a * 0.75 + smoothstep(0.35, 0.0, d) * 0.6;
  if (a * vAlpha < 0.003) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}`;

export function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: POINT_SCALE },
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// A fixed-size pool of glow points with CPU-side physics.
export class Particles {
  constructor(scene, max = 2600) {
    this.max = max; this.head = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.startSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha);
    this.points = new THREE.Points(g, makeGlowMaterial());
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.live = 0;
  }

  spawn(x, y, z, vx, vy, vz, c, size = 0.3, life = 0.6, drag = 1.5, grav = -6, grow = 0) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    this.base[o] = c[0]; this.base[o + 1] = c[1]; this.base[o + 2] = c[2];
    this.startSize[i] = size; this.size[i] = size; this.grow[i] = grow;
    this.life[i] = life; this.maxLife[i] = life;
    this.drag[i] = drag; this.grav[i] = grav;
  }

  burst(p, c, count = 20, speed = 8, size = 0.3, life = 0.6, grav = -5) {
    for (let k = 0; k < count; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const s = speed * (0.35 + Math.random() * 0.65);
      this.spawn(p.x, p.y, p.z, r * Math.cos(a) * s, u * s, r * Math.sin(a) * s, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), 2.2, grav);
    }
  }

  ring(p, c, count = 36, speed = 14, size = 0.35, life = 0.5) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      this.spawn(p.x, p.y, p.z, Math.cos(a) * speed, (Math.random() - 0.5) * 2, Math.sin(a) * speed, c, size, life, 1.2, 0);
    }
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      live++;
      this.life[i] -= dt;
      const o = i * 3, k = Math.exp(-this.drag[i] * dt);
      this.vel[o] *= k; this.vel[o + 1] = this.vel[o + 1] * k + this.grav[i] * dt; this.vel[o + 2] *= k;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = f;
      this.size[i] = this.startSize[i] * (1 + this.grow[i] * (1 - f));
      this.col[o] = this.base[o]; this.col[o + 1] = this.base[o + 1]; this.col[o + 2] = this.base[o + 2];
    }
    this.live = live;
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }

  clear() { this.life.fill(0); }
}

const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _d = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
export class Bolts {
  constructor(scene, fx, max = 70) {
    this.fx = fx; this.max = max;
    const geo = new THREE.CapsuleGeometry(0.13, 1.5, 3, 6); geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.6, 0.22, 0.1), fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = Array.from({ length: max }, () => ({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, dmg: 0, near: false, phased: false }));
    this.m4 = new THREE.Matrix4(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.zero);
  }

  fire(from, dir, speed, dmg) {
    const b = this.items.find((x) => !x.alive);
    if (!b) return null;
    b.alive = true; b.pos.copy(from); b.vel.copy(dir).multiplyScalar(speed); b.life = 3.2; b.dmg = dmg; b.near = false; b.phased = false;
    this.fx.burst(from, [1.4, 0.3, 0.1], 6, 4, 0.35, 0.25, 0);
    return b;
  }

  // world: city (pointBlocked); target: drone position; hooks: { hit(b) -> bool consumed, nearMiss(b) }
  update(dt, world, target, hitRadius, hooks) {
    for (let i = 0; i < this.max; i++) {
      const b = this.items[i];
      if (!b.alive) continue;
      b.life -= dt;
      const steps = 3;
      let dead = false;
      for (let s = 0; s < steps && !dead; s++) {
        b.pos.addScaledVector(b.vel, dt / steps);
        if (world.pointBlocked(b.pos.x, b.pos.y, b.pos.z, 0) || b.pos.y < 0.2) {
          this.fx.burst(b.pos, [1.4, 0.4, 0.1], 10, 6, 0.3, 0.35);
          dead = true;
        } else if (target) {
          const d = b.pos.distanceTo(target);
          if (d < hitRadius && !b.phased) {
            if (hooks.hit(b)) { dead = true; b.hitDrone = true; } else b.phased = true;
          } else if (d < 3.6) b.near = true;
        }
      }
      if (!dead && b.life <= 0) dead = true;
      if (dead) {
        if (b.near && !b.hitDrone && hooks.nearMiss) hooks.nearMiss(b);
        b.alive = false; b.hitDrone = false;
        this.mesh.setMatrixAt(i, this.zero);
        continue;
      }
      _d.copy(b.vel).normalize();
      _q.setFromUnitVectors(_z, _d);
      this.m4.compose(b.pos, _q, _one);
      this.mesh.setMatrixAt(i, this.m4);
      if (Math.random() < 0.6) this.fx.spawn(b.pos.x, b.pos.y, b.pos.z, 0, 0, 0, [1.2, 0.25, 0.08], 0.45, 0.16, 0, 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  destroyWithin(p, r) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const b = this.items[i];
      if (b.alive && b.pos.distanceTo(p) < r) {
        this.fx.burst(b.pos, [0.4, 0.8, 1.4], 6, 4, 0.3, 0.3);
        b.alive = false; this.mesh.setMatrixAt(i, this.zero); n++;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    return n;
  }

  clear() {
    for (let i = 0; i < this.max; i++) { this.items[i].alive = false; this.mesh.setMatrixAt(i, this.zero); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// A thin camera-facing light streak that follows a point and fades toward its tail.
export class Ribbon {
  constructor(scene, color, n = 14, width = 0.07, seg = 0.45) {
    this.n = n; this.width = width; this.seg = seg;
    this.pts = Array.from({ length: n }, () => new THREE.Vector3());
    this.ready = false;
    const pos = (this.pos = new Float32Array(n * 2 * 3));
    const fade = (this.fade = new Float32Array(n * 2));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aFade = new THREE.BufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aFade', this.aFade); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color().setRGB(...color) }, uStrength: { value: 0 } },
      vertexShader: `attribute float aFade; varying float vF; varying float vD; void main(){ vF = aFade; vD = distance(cameraPosition, position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // fade out close to the camera so the streak never smears across the screen
      fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vF; varying float vD; void main(){ gl_FragColor = vec4(uColor * vF * uStrength * smoothstep(3.5, 7.5, vD), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this._d = new THREE.Vector3(); this._c = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  reset(p) { for (const q of this.pts) q.copy(p); this.ready = true; }

  update(head, cam, strength) {
    const P = this.pts;
    if (!this.ready || head.distanceTo(P[0]) > 12) this.reset(head);
    if (head.distanceTo(P[1]) > this.seg) { for (let i = this.n - 1; i > 0; i--) P[i].copy(P[i - 1]); }
    P[0].copy(head);
    this.mesh.material.uniforms.uStrength.value += (strength - this.mesh.material.uniforms.uStrength.value) * 0.15;
    for (let i = 0; i < this.n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(this.n - 1, i + 1)];
      this._d.subVectors(a, b);
      if (this._d.lengthSq() < 1e-6) this._d.set(0, 0, 1);
      this._c.subVectors(cam, P[i]);
      this._s.crossVectors(this._d, this._c).normalize();
      const f = 1 - i / (this.n - 1), w = this.width * (0.35 + 0.65 * f);
      const o = i * 6;
      this.pos[o] = P[i].x + this._s.x * w; this.pos[o + 1] = P[i].y + this._s.y * w; this.pos[o + 2] = P[i].z + this._s.z * w;
      this.pos[o + 3] = P[i].x - this._s.x * w; this.pos[o + 4] = P[i].y - this._s.y * w; this.pos[o + 5] = P[i].z - this._s.z * w;
      this.fade[i * 2] = this.fade[i * 2 + 1] = f * f;
    }
    this.aPos.needsUpdate = true; this.aFade.needsUpdate = true;
  }
}
