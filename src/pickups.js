// Collectibles: data shards (score), echo beacons (torn story pieces) and power-ups.
import * as THREE from 'three';
import { makeGlowMaterial } from './fx.js';

const hdr = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const additive = (color, opacity) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });

// A small set of soft glow sprites that pickups hang off.
export function glowCloud(scene, n) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const aAlpha = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aPos); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', aSize); g.setAttribute('aAlpha', aAlpha);
  const points = new THREE.Points(g, makeGlowMaterial());
  points.frustumCulled = false; points.renderOrder = 4;
  scene.add(points);
  return {
    set(i, x, y, z, s, a) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; size[i] = s; alpha[i] = a; },
    color(i, c) { col.set(c, i * 3); g.attributes.aColor.needsUpdate = true; },
    commit() { aPos.needsUpdate = true; aSize.needsUpdate = true; aAlpha.needsUpdate = true; },
  };
}

export function createShards(scene, spots, fx) {
  const n = Math.max(1, spots.length);
  const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
  const CY = hdr(0.35, 1.0, 1.2), GOLD = hdr(1.3, 0.95, 0.25);
  const glow = glowCloud(scene, n);
  const items = spots.map(([x, y, z, gold], i) => {
    mesh.setColorAt(i, gold ? GOLD : CY);
    glow.color(i, gold ? [1.0, 0.72, 0.18] : [0.2, 0.75, 1.0]);
    return { x, y, z, home: y, gold: !!gold, alive: true, hidden: false, pull: 0 };
  });
  if (!spots.length) mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const api = {
    items, total: items.length, remaining: items.length,
    update(dt, t, p, magnet) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.alive) {
          if (!it.hidden) { mesh.setMatrixAt(i, zero); glow.set(i, 0, -999, 0, 0, 0); it.hidden = true; }
          continue;
        }
        let y = it.home + Math.sin(t * 2 + i) * 0.3;
        if (p) {
          const dx = p.x - it.x, dy = p.y - it.y, dz = p.z - it.z, d = Math.hypot(dx, dy, dz);
          if (d < magnet || it.pull > 0) {
            it.pull += dt;
            const step = Math.min(d, (14 + it.pull * 70) * dt);
            if (d > 0.001) { it.x += (dx / d) * step; it.home += (dy / d) * step; it.z += (dz / d) * step; }
            y = it.home;
          }
        }
        const s = it.gold ? 1.5 : 1.05;
        q.setFromEuler(e.set(0.35, t * 2.4 + i, 0));
        m4.compose(v.set(it.x, y, it.z), q, sc.setScalar(s));
        mesh.setMatrixAt(i, m4);
        glow.set(i, it.x, y, it.z, (it.gold ? 3.4 : 2.4) * (1 + 0.18 * Math.sin(t * 5 + i)), 0.85 + 0.15 * Math.sin(t * 3 + i * 1.7));
        it.y = y;
        if (fx && Math.random() < 0.004) fx.spawn(it.x + (Math.random() - 0.5), y + (Math.random() - 0.5), it.z + (Math.random() - 0.5), 0, 1.2, 0, it.gold ? [1, 0.8, 0.3] : [0.4, 0.9, 1.1], 0.22, 0.6, 0.5, 0);
      }
      mesh.instanceMatrix.needsUpdate = true;
      glow.commit();
    },
    collect(p, r) {
      const got = [];
      for (const it of items) {
        if (!it.alive) continue;
        const dx = it.x - p.x, dy = (it.y ?? it.home) - p.y, dz = it.z - p.z;
        if (dx * dx + dy * dy + dz * dz < r * r) { it.alive = false; api.remaining--; got.push(it); }
      }
      return got;
    },
  };
  return api;
}

export function createBeacons(scene, defs) {
  const VIO = hdr(0.85, 0.35, 1.35), PAGE = hdr(1.0, 0.88, 1.25);
  const crystalGeo = new THREE.OctahedronGeometry(0.8); crystalGeo.scale(0.7, 1.6, 0.7);
  const cageGeo = new THREE.IcosahedronGeometry(1.35, 0);
  const pageGeo = new THREE.PlaneGeometry(0.5, 0.68);
  const ringGeo = new THREE.RingGeometry(0.92, 1.0, 40);
  const glow = glowCloud(scene, Math.max(1, defs.length));
  const list = defs.map((d, idx) => {
    const g = new THREE.Group(); g.position.set(d.x, d.y, d.z);
    const crystal = new THREE.Mesh(crystalGeo, new THREE.MeshBasicMaterial({ color: VIO.clone() })); g.add(crystal);
    const cage = new THREE.Mesh(cageGeo, new THREE.MeshBasicMaterial({ color: VIO.clone().multiplyScalar(0.6), wireframe: true })); g.add(cage);
    const pageMat = new THREE.MeshBasicMaterial({ color: PAGE, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const pages = [];
    for (let k = 0; k < 6; k++) {
      const p = new THREE.Mesh(pageGeo, pageMat);
      p.userData = { a: (k / 6) * Math.PI * 2, h: (k % 3 - 1) * 0.55, s: 0.6 + Math.random() * 0.5 };
      g.add(p); pages.push(p);
    }
    const pillarH = d.y + 40;
    const pillarMat = additive(VIO.clone(), 0.22);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, pillarH, 6, 1, true), pillarMat);
    pillar.position.y = pillarH / 2 - d.y; g.add(pillar);
    const rings = [0, 1, 2].map((k) => {
      const m = additive(VIO.clone(), 0.5);
      const r = new THREE.Mesh(ringGeo, m); r.rotation.x = -Math.PI / 2; r.userData.off = k / 3; g.add(r); return r;
    });
    glow.color(idx, [0.75, 0.3, 1.0]);
    scene.add(g);
    return { ...d, group: g, crystal, cage, pages, rings, alive: true, idx };
  });
  return {
    list,
    get remaining() { return list.filter((b) => b.alive).length; },
    update(dt, t) {
      for (const b of list) {
        if (!b.alive) { glow.set(b.idx, 0, -999, 0, 0, 0); continue; }
        b.crystal.rotation.y = t * 1.2; b.crystal.position.y = Math.sin(t * 1.6 + b.idx) * 0.25;
        b.cage.rotation.x = t * 0.5; b.cage.rotation.y = -t * 0.7;
        for (const p of b.pages) {
          const u = p.userData, a = u.a + t * u.s;
          p.position.set(Math.cos(a) * 1.9, u.h + Math.sin(t * 2 + u.a * 3) * 0.3, Math.sin(a) * 1.9);
          p.rotation.set(Math.sin(t * 3 + u.a) * 0.8, -a, Math.sin(t * 2.3 + u.a) * 0.6);
        }
        for (const r of b.rings) {
          const f = (t * 0.45 + r.userData.off) % 1;
          r.scale.setScalar(1 + f * 7); r.material.opacity = 0.55 * (1 - f);
        }
        glow.set(b.idx, b.x, b.y + b.crystal.position.y, b.z, 7 + Math.sin(t * 3 + b.idx) * 1.2, 0.85);
      }
      glow.commit();
    },
    collect(p, r) {
      for (const b of list) {
        if (b.alive && Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) < r) {
          b.alive = false; b.group.visible = false;
          return b;
        }
      }
      return null;
    },
  };
}

export const POWER = {
  emp: { label: 'EMP', color: [0.3, 0.75, 1.5], hint: 'stuns nearby enemies and wipes their shots' },
  cloak: { label: 'CLOAK', color: [0.9, 0.95, 1.15], hint: '7 s invisible to sentinels and searchlights' },
  magnet: { label: 'MAGNET', color: [1.4, 0.55, 0.1], hint: '12 s huge shard magnet' },
  repair: { label: 'REPAIR', color: [0.2, 1.35, 0.5], hint: '+30 HP' },
};

export function createPowerups(scene, defs) {
  const hexGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.42, 6);
  const bandGeo = new THREE.TorusGeometry(0.95, 0.06, 6, 30);
  const iconGeo = new THREE.OctahedronGeometry(0.42);
  const crossA = new THREE.BoxGeometry(0.75, 0.22, 0.22), crossB = new THREE.BoxGeometry(0.22, 0.75, 0.22);
  const dark = new THREE.MeshBasicMaterial({ color: 0x151a24 });
  const glow = glowCloud(scene, Math.max(1, defs.length));
  const list = defs.map((d, idx) => {
    const P = POWER[d.type], c = hdr(...P.color);
    const g = new THREE.Group(); g.position.set(d.x, d.y, d.z);
    const spin = new THREE.Group(); g.add(spin);
    const hex = new THREE.Mesh(hexGeo, dark); hex.rotation.x = Math.PI / 2; spin.add(hex);
    const mat = new THREE.MeshBasicMaterial({ color: c });
    const band = new THREE.Mesh(bandGeo, mat); spin.add(band);
    if (d.type === 'repair') { const a = new THREE.Mesh(crossA, mat), b = new THREE.Mesh(crossB, mat); a.position.z = b.position.z = 0.25; spin.add(a, b); }
    else { const ic = new THREE.Mesh(iconGeo, mat); ic.position.z = 0.25; spin.add(ic); }
    const beamMat = additive(c.clone(), 0.18);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.6, d.y + 4, 10, 1, true), beamMat);
    beam.position.y = (d.y + 4) / 2 - d.y; g.add(beam);
    glow.color(idx, P.color.map((v) => v * 0.7));
    scene.add(g);
    return { ...d, group: g, spin, alive: true, idx };
  });
  return {
    list,
    update(dt, t) {
      for (const p of list) {
        if (!p.alive) { glow.set(p.idx, 0, -999, 0, 0, 0); continue; }
        p.spin.rotation.y = t * 1.8; p.spin.position.y = Math.sin(t * 2 + p.idx) * 0.3;
        glow.set(p.idx, p.x, p.y + p.spin.position.y, p.z, 4.2 + Math.sin(t * 4 + p.idx) * 0.6, 0.8);
      }
      glow.commit();
    },
    collect(pos, r, canTake) {
      for (const p of list) {
        if (p.alive && Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z) < r && canTake(p.type)) {
          p.alive = false; p.group.visible = false;
          return p;
        }
      }
      return null;
    },
  };
}
