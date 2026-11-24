// The Warden: guardian of the core on every 5th sector.
// It fires spread volleys, then vents heat — while venting its three coolant pods glow green
// and can be destroyed by flying straight through them. Touching anything else hurts.
import * as THREE from 'three';

const hdr = (r, g, b) => new THREE.Color().setRGB(r, g, b);

export function createWarden(scene, fx, bolts, cfg) {
  const g = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: 0x191c26 });
  const plate = new THREE.MeshBasicMaterial({ color: 0x252a38 });
  const RED = hdr(1.5, 0.08, 0.05), HOT = hdr(1.2, 0.35, 0.06), VENT = hdr(0.25, 1.4, 0.45);

  // the head turns to face the drone; the pod ring stays level so pods can be intercepted
  const head = new THREE.Group(); g.add(head);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), dark); head.add(body);
  for (let k = 0; k < 8; k++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 2.2), plate);
    const a = (k / 8) * Math.PI * 2;
    p.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0.4); p.lookAt(0, 0, 0);
    head.add(p);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: RED.clone() });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), eyeMat); eye.position.z = 2.8; head.add(eye);
  const iris = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 32), eyeMat); iris.position.z = 2.9; head.add(iris);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.16, 6, 64), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(0.5) }));
  crown.rotation.x = Math.PI / 2; g.add(crown);

  const arms = new THREE.Group(); g.add(arms);
  const pods = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 0.5), plate);
    arm.position.set(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6); arm.rotation.y = -a;
    arms.add(arm);
    const mat = new THREE.MeshBasicMaterial({ color: HOT.clone() });
    const pod = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), mat);
    pod.position.set(Math.cos(a) * 7, 0, Math.sin(a) * 7);
    const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 0), new THREE.MeshBasicMaterial({ color: 0x3a3f52, wireframe: true }));
    pod.add(cage);
    arms.add(pod);
    pods.push({ mesh: pod, mat, cage, alive: true, world: new THREE.Vector3() });
  }
  scene.add(g);

  const w = {
    pos: g.position, alive: true, phase: 'attack', phaseT: 2.5, volleys: 0, angle: 0, stunT: 0, ramCD: 0,
    get podsLeft() { return pods.filter((p) => p.alive).length; },
    get venting() { return w.phase === 'vent'; },
    stun(s) { w.stunT = Math.max(w.stunT, s); w.phase = 'vent'; w.phaseT = Math.max(w.phaseT, s); },
    update(dt, t, player, playerRadius, los, speedMul = 1) {
      const ev = [];
      if (!w.alive) return ev;
      w.angle += dt * 0.22 * speedMul;
      g.position.set(Math.cos(w.angle) * 24, 22 + Math.sin(t * 0.8) * 2, Math.sin(w.angle) * 24);
      if (player) head.lookAt(player);
      arms.rotation.y += dt * (w.phase === 'vent' ? 0.35 : 1.3);
      crown.rotation.z -= dt * 0.6;
      w.ramCD -= dt;
      if (w.stunT > 0) w.stunT -= dt;
      const dist = player ? g.position.distanceTo(player) : 999;

      if (w.phase === 'attack') {
        w.phaseT -= dt;
        eyeMat.color.copy(RED).multiplyScalar(0.7 + 0.3 * Math.sin(t * 8));
        if (w.phaseT <= 0 && player && dist < 110 && los(eye.getWorldPosition(new THREE.Vector3()), player)) {
          const from = eye.getWorldPosition(new THREE.Vector3());
          const dir = player.clone().sub(from).normalize();
          const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
          for (let s = -2; s <= 2; s++) {
            const d = dir.clone().addScaledVector(side, s * 0.09).addScaledVector(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.05).normalize();
            bolts.fire(from, d, cfg.boltSpeed * 0.9 * speedMul, cfg.boltDamage);
          }
          ev.push({ type: 'volley' });
          w.volleys++;
          w.phaseT = 2.0 / speedMul;
          if (w.volleys >= 2) { w.phase = 'vent'; w.phaseT = 4.2; w.volleys = 0; ev.push({ type: 'vent' }); }
        }
      } else {
        w.phaseT -= dt;
        eyeMat.color.copy(RED).multiplyScalar(0.3);
        if (w.phaseT <= 0 && w.stunT <= 0) { w.phase = 'attack'; w.phaseT = 1.4; }
      }

      for (const p of pods) {
        if (!p.alive) continue;
        p.mesh.getWorldPosition(p.world);
        const vent = w.phase === 'vent';
        p.mat.color.copy(vent ? VENT : HOT).multiplyScalar(vent ? 0.8 + 0.4 * Math.sin(t * 10) : 0.8);
        p.cage.visible = !vent;
        if (vent && Math.random() < 0.5) fx.spawn(p.world.x, p.world.y, p.world.z, (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2, [0.2, 0.9, 0.4], 0.5, 0.6, 1, 1);
        if (player && p.world.distanceTo(player) < 1.3 + playerRadius) {
          if (vent) {
            p.alive = false; p.mesh.visible = false;
            fx.burst(p.world, [0.4, 1.4, 0.5], 60, 18, 0.5, 0.9);
            ev.push({ type: 'pod', pos: p.world.clone() });
          } else if (w.ramCD <= 0) { w.ramCD = 1; ev.push({ type: 'ram', dmg: 14, pos: p.world.clone() }); }
        }
      }
      if (player && dist < 3.8 + playerRadius && w.ramCD <= 0) { w.ramCD = 1; ev.push({ type: 'ram', dmg: 18, pos: g.position.clone() }); }

      if (w.podsLeft === 0) {
        w.alive = false; g.visible = false;
        for (let k = 0; k < 4; k++) fx.burst(g.position, k % 2 ? [1.5, 0.3, 0.1] : [1.2, 0.9, 0.3], 90, 26 + k * 6, 0.6, 1.4, -3);
        ev.push({ type: 'dead', pos: g.position.clone() });
      }
      return ev;
    },
  };
  return w;
}
