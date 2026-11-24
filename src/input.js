// Unified input: keyboard + mouse, gamepad and touch. Continuous controls are read with axes()/look();
// one-shot buttons (interact, dash, power-up, pause, archive) are forwarded to onAction(code).
const DEAD = 0.16;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

const PAD_ACTIONS = { 0: 'Confirm', 1: 'KeyQ', 2: 'KeyF', 3: 'Tab', 9: 'KeyP', 8: 'KeyP' };

export class Input {
  constructor(dom, settings, onAction) {
    this.dom = dom; this.settings = settings; this.onAction = onAction;
    this.keys = new Set();
    this.mdx = 0; this.mdy = 0;
    this.pad = { lx: 0, ly: 0, rx: 0, ry: 0, up: 0, down: 0, boost: false, prev: [] };
    this.touch = { mx: 0, my: 0, moveId: null, ox: 0, oy: 0, lookId: null, lx: 0, ly: 0, dx: 0, dy: 0, up: false, down: false, boost: false };
    this.usingTouch = false;

    addEventListener('keydown', (e) => {
      // Ctrl / Cmd / Alt combos belong to the browser (Ctrl+W closes the tab, Ctrl+Q quits) — never steer with them
      if (e.ctrlKey || e.metaKey || e.altKey) { this.keys.clear(); return; }
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') e.preventDefault(); // Space is climb: never let it 'click' a focused button
    });
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom) return;
      this.mdx += e.movementX; this.mdy += e.movementY;
    });
  }

  bindTouch(root) {
    const T = this.touch;
    const left = root.querySelector('#tzLeft'), right = root.querySelector('#tzRight'), knob = root.querySelector('#tKnob'), base = root.querySelector('#tBase');
    const show = () => { if (!this.usingTouch) { this.usingTouch = true; root.classList.add('on'); } };
    addEventListener('touchstart', show, { passive: true });
    left.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; T.moveId = t.identifier; T.ox = t.clientX; T.oy = t.clientY;
      base.style.left = knob.style.left = t.clientX + 'px'; base.style.top = knob.style.top = t.clientY + 'px'; base.classList.add('on'); knob.classList.add('on');
      e.preventDefault();
    }, { passive: false });
    right.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; T.lookId = t.identifier; T.lx = t.clientX; T.ly = t.clientY; e.preventDefault();
    }, { passive: false });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.moveId) {
          const dx = t.clientX - T.ox, dy = t.clientY - T.oy, r = Math.min(55, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
          T.mx = (Math.cos(a) * r) / 55; T.my = (Math.sin(a) * r) / 55;
          knob.style.left = T.ox + Math.cos(a) * r + 'px'; knob.style.top = T.oy + Math.sin(a) * r + 'px';
        } else if (t.identifier === T.lookId) {
          T.dx += t.clientX - T.lx; T.dy += t.clientY - T.ly; T.lx = t.clientX; T.ly = t.clientY;
        }
      }
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.moveId) { T.moveId = null; T.mx = T.my = 0; base.classList.remove('on'); knob.classList.remove('on'); }
        if (t.identifier === T.lookId) T.lookId = null;
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    root.querySelectorAll('[data-hold]').forEach((b) => {
      const k = b.dataset.hold;
      b.addEventListener('touchstart', (e) => { T[k] = true; b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      b.addEventListener('touchend', (e) => { T[k] = false; b.classList.remove('down'); e.preventDefault(); });
    });
    root.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('touchstart', (e) => { this.onAction(b.dataset.act); b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      b.addEventListener('touchend', () => b.classList.remove('down'));
    });
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find((p) => p && p.connected);
    const P = this.pad;
    if (!gp) { P.lx = P.ly = P.rx = P.ry = P.up = P.down = 0; P.boost = false; return; }
    P.lx = dz(gp.axes[0] || 0); P.ly = dz(gp.axes[1] || 0); P.rx = dz(gp.axes[2] || 0); P.ry = dz(gp.axes[3] || 0);
    const b = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3);
    P.up = b(5) ? 1 : 0; P.down = b(4) || b(6) ? 1 : 0; P.boost = !!b(7);
    for (const [i, code] of Object.entries(PAD_ACTIONS)) {
      const now = !!b(+i);
      if (now && !P.prev[i]) this.onAction(code);
      P.prev[i] = now;
    }
  }

  axes() {
    const k = (c) => (this.keys.has(c) ? 1 : 0), P = this.pad, T = this.touch;
    return {
      fwd: clamp1(k('KeyW') - k('KeyS') - P.ly - T.my),
      strafe: clamp1(k('KeyD') - k('KeyA') + P.lx + T.mx),
      up: clamp1(k('Space') - k('KeyE') + P.up - P.down + (T.up ? 1 : 0) - (T.down ? 1 : 0)),
      boost: !!(k('ShiftLeft') || k('ShiftRight') || P.boost || T.boost),
    };
  }

  // yaw / pitch deltas in radians for this frame
  look(dt) {
    const s = this.settings.sens, inv = this.settings.invertY ? -1 : 1, k = (c) => (this.keys.has(c) ? 1 : 0), P = this.pad, T = this.touch;
    let yaw = -this.mdx * 0.0022 * s, pitch = -this.mdy * 0.0019 * s * inv;
    yaw += (k('ArrowLeft') - k('ArrowRight')) * 1.9 * dt;
    pitch += (k('ArrowUp') - k('ArrowDown')) * 1.2 * dt;
    yaw -= P.rx * 2.6 * dt * s; pitch -= P.ry * 1.8 * dt * s * inv;
    yaw -= T.dx * 0.005 * s; pitch -= T.dy * 0.004 * s * inv;
    this.mdx = this.mdy = 0; T.dx = T.dy = 0;
    return { yaw, pitch };
  }
}
