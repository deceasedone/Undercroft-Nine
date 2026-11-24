// UNDERCROFT NINE — renderer, sector building, combat, scoring, HUD and menus.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { generateCity, mulberry32, cellCenter, HALF, N, START_CELL } from './cityGen.js';
import { Drone, DRONE_RADIUS } from './player.js';
import { createTerminals, createSentinels, createWatchers, createCore, createTraffic, createRain } from './entities.js';
import { createShards, createBeacons, createPowerups, POWER } from './pickups.js';
import { Particles, Bolts, Ribbon, POINT_SCALE } from './fx.js';
import { createWarden } from './boss.js';
import { createHoloAds, createSteam } from './decor.js';
import { Input } from './input.js';
import { settings, saveSettings } from './settings.js';
import { Soundscape } from './audio.js';
import { LOGS, FRAGMENTS, TRANSMISSIONS, ENDING } from './lore.js';
import { Archive, SECRET_ENDING } from './archive.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const fixedSeed = parseInt(params.get('seed'), 10) || 0;
const todayKey = new Date().toISOString().slice(0, 10);
const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const dailySeed = (hashStr('undercroft9:' + todayKey) % 99999) + 1;
const seedFor = (sector, mode) => {
  const base = mode === 'daily' ? dailySeed : fixedSeed;
  return base ? base + (sector - 1) * 7919 : Math.floor(Math.random() * 99999) + 1;
};

const loadJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const SCORES_KEY = 'undercroft9.scores';

const COMBO_TIME = 3, MAX_HP = 100, THREAT_PERIOD = 300;
const PICKUP_R = 3.5, MAGNET_R = 8, MAGNET_POWER_R = 26;
const pad = (n, w = 2) => String(n).padStart(w, '0');
const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const canvas = $('game');
const vw = () => Math.max(innerWidth, 16), vh = () => Math.max(innerHeight, 16);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, vw() / vh(), 0.1, 520);
const FOG = new THREE.Color(0x07050f);
scene.background = FOG;
scene.fog = new THREE.FogExp2(FOG, 0.0105);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(vw(), vh()), 0.38, 0.5, 0.62);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function applyQuality() {
  const q = settings.quality;
  renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio, 1.5) : q === 'medium' ? Math.min(devicePixelRatio, 1) : 0.75);
  bloom.enabled = q !== 'low';
  resize();
}
function resize() {
  camera.aspect = vw() / vh(); camera.updateProjectionMatrix();
  renderer.setSize(vw(), vh()); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(vw(), vh());
  POINT_SCALE.value = renderer.domElement.height * 0.5;
}
addEventListener('resize', resize);
applyQuality();

const fx = new Particles(scene);
const bolts = new Bolts(scene, fx);
const drone = new Drone(scene, camera);
const START = [cellCenter(START_CELL[0]), 5, cellCenter(START_CELL[1])];
const audio = new Soundscape();
audio.vol = { music: settings.music, sfx: settings.sfx };
const archive = new Archive();
const input = new Input(canvas, settings, (code) => handleAction(code));
input.bindTouch($('touch'));

drone.onImpact = (speed, n, p) => {
  audio.bonk(speed);
  const at = p.clone().addScaledVector(n, -DRONE_RADIUS);
  fx.burst(at, [1.4, 0.75, 0.25], Math.min(36, Math.round(speed * 1.6)), speed * 0.5, 0.28, 0.5, -9);
  drone.shake = Math.max(drone.shake, Math.min(0.5, speed * 0.025));
};

function sectorConfig(n) {
  const d = n - 1, boss = n % 5 === 0;
  const nodes = Math.min(8, 4 + Math.max(0, d - 1));
  return {
    nodes, boss,
    sentinels: Math.min(14, 5 + d * 2) - (boss ? 3 : 0),
    watchers: Math.min(5, d),
    sight: Math.min(30, 19 + d * 1.2),
    speed: 9 + d * 1.2, huntSpeed: 14 + d * 1.6,
    watcherRadius: Math.min(12, 8 + d * 0.7), watcherSpeed: 7 + d * 1.2,
    fireInterval: Math.max(1.1, 2.6 - d * 0.18), windup: Math.max(0.38, 0.75 - d * 0.04),
    boltSpeed: 34 + d * 3, boltDamage: 9 + Math.min(10, Math.round(d * 1.5)),
    beacons: d === 0 ? 2 : 3, powerups: 2, repairs: d === 0 ? 1 : 2,
    par: 70 + nodes * 22 + (boss ? 60 : 0),
  };
}

let L = null;
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose();
      m.dispose();
    }
  });
}
function pickSpread(spots, n, rnd, minD) {
  const pool = spots.slice();
  for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [pool[i], pool[k]] = [pool[k], pool[i]]; }
  const out = [];
  for (let d = minD; out.length < n && d >= 0; d -= 15) {
    for (const s of pool) {
      if (out.length >= n) break;
      if (out.includes(s)) continue;
      if (Math.hypot(s[0] - START[0], s[2] - START[2]) < 25) continue;
      if (out.every((o) => Math.hypot(o[0] - s[0], o[2] - s[2]) >= d)) out.push(s);
    }
  }
  return out;
}

function buildLevel(sector, seed) {
  if (L) { scene.remove(L.root); disposeTree(L.root); }
  bolts.clear(); fx.clear();
  const cfg = sectorConfig(sector);
  const root = new THREE.Group();
  scene.add(root);
  const city = generateCity(seed, { nodes: cfg.nodes });
  root.add(city.group);
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const pieces = archive.nextPieces(cfg.beacons, rnd);
  const bSpots = pickSpread(city.beaconSpots, pieces.length, rnd, 70);
  const beaconDefs = bSpots.map(([x, y, z], i) => ({ x, y, z, piece: pieces[i] }));
  const types = [];
  for (let k = 0; k < cfg.powerups; k++) types.push(['emp', 'cloak', 'magnet'][Math.floor(rnd() * 3)]);
  for (let k = 0; k < cfg.repairs; k++) types.push('repair');
  const pSpots = pickSpread(city.powerSpots, types.length, rnd, 50);
  const powerDefs = pSpots.map(([x, y, z], i) => ({ x, y, z, type: types[i] }));
  L = {
    root, city, cfg, sector, seed,
    terminals: createTerminals(root, city.terminals),
    sentinels: createSentinels(root, rnd, cfg.sentinels, cfg),
    watchers: createWatchers(root, rnd, cfg.watchers, cfg),
    shards: createShards(root, city.shards, fx),
    beacons: createBeacons(root, beaconDefs),
    powerups: createPowerups(root, powerDefs),
    core: createCore(root),
    traffic: createTraffic(root, city.neonMaterial, rnd),
    steam: createSteam(fx, city.ventSpots),
    warden: cfg.boss ? createWarden(root, fx, bolts, cfg) : null,
    found: 0, time: 0, damageTaken: 0, echoes: 0,
  };
  createRain(root, city.shared);
  createHoloAds(root, city.holoSpots, city.shared, rnd);
  L.core.setShield(!!L.warden);
  drone.world = city;
  $('pips').innerHTML = '';
  L.pips = L.terminals.map(() => $('pips').appendChild(document.createElement('i')));
  $('seed').textContent = (run && run.mode === 'daily' ? 'DAILY ' : 'SEED ') + pad(seed, 5);
  drawMapBase();
  console.log(`UNDERCROFT NINE — sector ${sector}, seed ${seed}`, city.stats);
}

const game = { state: 'menu', near: null, grace: 0, echoT: 0, returnTo: null };
let scores = loadJSON(SCORES_KEY, []);
let best = scores.length ? scores[0].score : 0;
let run = null;
let typing = null;
let pingTimer = 0, warnTimer = 0, toastTimer = 0, frame = 0, intensity = 0, chargeTimer = 0;

function newRun(mode) {
  const frag = FRAGMENTS.map((_, i) => i).sort(() => Math.random() - 0.5);
  return {
    mode, score: 0, hp: MAX_HP, chain: 0, mult: 1, comboT: 0, sector: 1, shards: 0, nodes: 0, echoes: 0, time: 0,
    story: 0, endingShown: false, frag, fragI: 0, threat: 1, power: null, cloakT: 0, magnetT: 0, markedT: 0, invulnT: 0, nearMisses: 0,
  };
}
const calcMult = () => Math.min(8, 1 + Math.floor(run.chain / 5));

const hud = $('hud');
const bars = Array.from({ length: 8 }, (_, i) => { const b = $('bars').appendChild(document.createElement('i')); b.style.height = 4 + i * 1.7 + 'px'; return b; });

function toast(msg, sub = '', secs = 3.5) {
  $('toast').innerHTML = msg + (sub ? `<small>${sub}</small>` : '');
  $('toast').classList.add('on'); toastTimer = secs;
}
function popup(text, cls = '') {
  const box = $('pops');
  while (box.childElementCount > 10) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'pop ' + cls; el.textContent = text;
  el.style.left = 50 + (Math.random() * 10 - 5) + '%';
  el.addEventListener('animationend', () => el.remove());
  box.appendChild(el);
}
function addScore(base, label = '', cls = '') {
  const pts = Math.round(base * run.mult);
  run.score += pts;
  popup(`+${pts}${label ? ' ' + label : ''}${run.mult > 1 ? ' ×' + run.mult : ''}`, cls);
  return pts;
}
function setObjective() {
  const left = L.terminals.length - L.found;
  $('objective').textContent = left > 0 ? `RECOVER DATA NODES — ${left} REMAINING`
    : L.warden && L.warden.alive ? 'DESTROY THE WARDEN — FLY THROUGH ITS COOLANT PODS WHILE THEY GLOW GREEN'
      : 'UPLINK OPEN — FLY INTO THE CORE AT THE CITY CENTRE';
}
function renderTop(el, highlight = -1) {
  if (!scores.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h5>TOP RUNS</h5><ol>${scores.map((s, i) => `<li class="${i === highlight ? 'me' : ''}"><span>${pad(i + 1)} · ${s.mode === 'daily' ? 'DAILY ' : ''}${s.date} · SECTOR ${pad(s.sector)}</span><b>${pad(s.score, 7)}</b></li>`).join('')}</ol>`;
}
function refreshMenu() {
  $('startBest').textContent = pad(best, 7);
  renderTop($('startTop'));
  $('btnDaily').textContent = `DAILY RUN · ${todayKey}`;
}

const mm = $('minimap'), mctx = mm.getContext('2d');
const MS = mm.width / (HALF * 2 + 12), mx = (x) => mm.width / 2 + x * MS;
const mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = mm.width;
function drawMapBase() {
  const g = mapBase.getContext('2d');
  g.clearRect(0, 0, mm.width, mm.width);
  g.fillStyle = 'rgba(4,8,14,.85)'; g.fillRect(0, 0, mm.width, mm.width);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const c = L.city.grid[i][j];
    if (c.type === 'street' || c.type === 'plaza') continue;
    const x = cellCenter(i), z = cellCenter(j);
    if (c.type === 'bldg') {
      g.fillStyle = `rgba(95,242,255,${0.08 + Math.min(0.22, c.h / 300)})`;
      g.fillRect(mx(x - c.sx / 2), mx(z - c.sz / 2), c.sx * MS, c.sz * MS);
    } else {
      g.strokeStyle = 'rgba(95,242,255,.16)'; g.lineWidth = 1;
      g.strokeRect(mx(x - 7), mx(z - 7), 14 * MS, 14 * MS);
    }
  }
  g.strokeStyle = 'rgba(95,242,255,.4)'; g.lineWidth = 2; g.strokeRect(mx(-HALF), mx(-HALF), HALF * 2 * MS, HALF * 2 * MS);
}
function diamond(g, x, y, s, color) { g.fillStyle = color; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-s, -s, s * 2, s * 2); g.restore(); }
function drawMinimap(t) {
  const g = mctx, { terminals, sentinels, watchers, core, cfg, beacons, powerups, warden } = L;
  g.clearRect(0, 0, mm.width, mm.width); g.drawImage(mapBase, 0, 0);
  g.strokeStyle = core.active ? '#9ff' : core.shielded ? '#ff3b30' : '#b0309a'; g.lineWidth = 2;
  g.beginPath(); g.arc(mx(0), mx(0), 7 + (core.active ? 3 * Math.sin(t * 5) : 0), 0, 7); g.stroke();
  for (const tm of terminals) diamond(g, mx(tm.x), mx(tm.z), tm.collected ? 4 : 5 + Math.sin(t * 6), tm.collected ? 'rgba(60,255,170,.6)' : '#ffd426');
  for (const b of beacons.list) if (b.alive) diamond(g, mx(b.x), mx(b.z), 5 + Math.sin(t * 5), '#c47bff');
  for (const p of powerups.list) if (p.alive) { g.fillStyle = p.type === 'repair' ? '#3dff8c' : '#ffb347'; g.beginPath(); g.arc(mx(p.x), mx(p.z), 4, 0, 7); g.fill(); }
  for (const w of watchers) {
    g.fillStyle = `rgba(170,200,255,${0.12 + w.alert * 0.2})`;
    g.beginPath(); g.arc(mx(w.pos.x), mx(w.pos.z), w.radius * MS, 0, 7); g.fill();
  }
  for (const s of sentinels) {
    const hot = s.hunt > 0, stun = s.stun > 0;
    g.fillStyle = stun ? 'rgba(80,140,255,.15)' : hot ? 'rgba(255,40,30,.28)' : 'rgba(255,110,40,.1)';
    g.beginPath(); g.arc(mx(s.pos.x), mx(s.pos.z), cfg.sight * MS, 0, 7); g.fill();
    g.fillStyle = stun ? '#6aa0ff' : hot ? '#ff3b30' : '#ff8a3b'; g.beginPath(); g.arc(mx(s.pos.x), mx(s.pos.z), 3.5, 0, 7); g.fill();
  }
  if (warden && warden.alive) { g.strokeStyle = '#ff3b30'; g.lineWidth = 3; g.beginPath(); g.arc(mx(warden.pos.x), mx(warden.pos.z), 8, 0, 7); g.stroke(); }
  g.save(); g.translate(mx(drone.pos.x), mx(drone.pos.z)); g.rotate(-drone.yaw);
  g.fillStyle = '#fff'; g.shadowColor = '#5ff2ff'; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.restore();
}

// on-screen and edge-of-screen markers for things worth flying to
const indPool = [];
const _pv = new THREE.Vector3(), _rel = new THREE.Vector3();
function ind(i) {
  while (indPool.length <= i) {
    const d = document.createElement('div'); d.className = 'ind'; d.innerHTML = '<i></i><span></span>';
    $('indicators').appendChild(d); indPool.push(d);
  }
  return indPool[i];
}
function updateIndicators() {
  let n = 0;
  if (game.state === 'play') {
    const p = drone.pos, W = vw(), H = vh();
    const T = [];
    for (const tm of L.terminals) if (!tm.collected) T.push([tm.x, 4, tm.z, '#ffd426', 'NODE']);
    for (const b of L.beacons.list) if (b.alive) T.push([b.x, b.y, b.z, '#c47bff', 'ECHO']);
    if (L.core.active) T.push([0, 16, 0, '#5ff2ff', 'UPLINK']);
    if (L.warden && L.warden.alive) T.push([L.warden.pos.x, L.warden.pos.y, L.warden.pos.z, '#ff3b30', 'WARDEN']);
    for (const pu of L.powerups.list) if (pu.alive && Math.hypot(pu.x - p.x, pu.z - p.z) < 110) T.push([pu.x, pu.y, pu.z, pu.type === 'repair' ? '#3dff8c' : '#ffb347', POWER[pu.type].label]);
    for (const b of bolts.items) {
      if (!b.alive) continue;
      _rel.copy(p).sub(b.pos);
      if (_rel.length() < 30 && _rel.dot(b.vel) > 0) T.push([b.pos.x, b.pos.y, b.pos.z, '#ff3b30', '!', true]);
    }
    for (const [x, y, z, color, label, edgeOnly] of T) {
      const d = Math.hypot(x - p.x, y - p.y, z - p.z);
      _pv.set(x, y, z).project(camera);
      const behind = _pv.z > 1;
      let sx = _pv.x, sy = _pv.y;
      if (behind) { sx = -sx; sy = -sy; }
      const onScreen = !behind && Math.abs(sx) < 0.9 && Math.abs(sy) < 0.85;
      if (onScreen && (edgeOnly || d < 10)) continue;
      const el = ind(n++);
      let px, py;
      if (onScreen) {
        el.classList.remove('edge');
        px = (sx * 0.5 + 0.5) * W; py = (-sy * 0.5 + 0.5) * H;
        el.lastChild.textContent = `${label} ${Math.round(d)}m`;
      } else {
        el.classList.add('edge');
        const a = Math.atan2(sy, sx);
        const m = Math.max(Math.abs(Math.cos(a)) / 0.9, Math.abs(Math.sin(a)) / 0.82);
        px = ((Math.cos(a) / m) * 0.5 + 0.5) * W; py = ((-Math.sin(a) / m) * 0.5 + 0.5) * H;
        el.style.setProperty('--a', Math.PI / 2 - a + 'rad');
        el.lastChild.textContent = edgeOnly ? '' : `${label} ${Math.round(d)}m`;
      }
      el.style.color = color; el.style.left = px + 'px'; el.style.top = py + 'px';
      el.classList.add('on');
    }
  }
  for (let i = n; i < indPool.length; i++) indPool[i].classList.remove('on');
}

function lockPointer() {
  if (input.usingTouch) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* optional */ }
}
function flash(opacity) {
  const f = $('flash');
  f.style.transition = 'none'; f.style.opacity = opacity;
  requestAnimationFrame(() => { f.style.transition = 'opacity 1.0s'; f.style.opacity = 0; });
}
function show(id, on) { $(id).classList.toggle('on', on); }

function beginSector() {
  drone.place(...START);
  game.state = 'play'; game.grace = 3; run.markedT = 0;
  setObjective(); lockPointer();
  const c = L.cfg;
  toast(c.boss ? `SECTOR ${pad(run.sector)} — THE WARDEN` : `SECTOR ${pad(run.sector)}`,
    `${c.sentinels} sentinels${c.watchers ? ` · ${c.watchers} searchlight${c.watchers > 1 ? 's' : ''}` : ''} · ${c.nodes} nodes · ${L.beacons.list.length} echo beacons${c.boss ? ' · the core is shielded until the Warden falls' : ''}`, 5);
}

function startGame(mode = 'normal') {
  document.activeElement?.blur?.();
  audio.start(); audio.setVolumes(settings.music, settings.sfx);
  run = newRun(mode);
  buildLevel(1, seedFor(1, mode));
  ['start', 'over', 'clear', 'pause'].forEach((id) => show(id, false));
  hud.classList.add('on');
  beginSector();
}

function openLog(term) {
  term.collect(); L.found++; run.nodes++;
  L.pips[L.found - 1].classList.add('on');
  run.chain += 2; run.comboT = COMBO_TIME; run.mult = calcMult();
  const pts = addScore(300 + 100 * (run.sector - 1), 'NODE', 'node');
  fx.burst(new THREE.Vector3(term.x, 4, term.z), [1.2, 0.85, 0.15], 50, 12, 0.4, 0.9);
  const log = run.story < LOGS.length ? LOGS[run.story++] : FRAGMENTS[run.frag[run.fragI++ % run.frag.length]];
  game.state = 'log'; game.near = null;
  $('logNode').textContent = `SECTOR ${pad(run.sector)} · NODE ${pad(L.found)} / ${pad(L.terminals.length)}`;
  $('logTitle').textContent = log.title; $('logMeta').textContent = log.meta;
  $('logCount').textContent = `+${pts} PTS · ${L.found} OF ${L.terminals.length} RECOVERED`;
  $('logBody').textContent = '';
  typing = { el: $('logBody'), text: log.body, shown: 0, clock: 0 };
  show('log', true); audio.jackIn(); setObjective();
}
const finishTyping = () => {
  if (typing && typing.shown < typing.text.length) { typing.shown = typing.text.length; typing.el.textContent = typing.text; return true; }
  return false;
};
function closeLog() {
  if (finishTyping()) return;
  show('log', false); typing = null; game.state = 'play';
  tryActivateCore();
}
function tryActivateCore() {
  if (L.core.active || L.found < L.terminals.length || (L.warden && L.warden.alive)) return;
  L.core.activate(); L.core.setShield(false); audio.coreOpen();
  toast('UPLINK OPEN', 'a pillar of light marks the core at the centre of the city', 6);
  setObjective();
}

function damage(d) {
  if (game.grace > 0 || drone.dashT > 0 || run.invulnT > 0) return false;
  run.hp = Math.max(0, run.hp - d); run.invulnT = 0.35; L.damageTaken += d;
  run.chain = 0; run.mult = 1; run.comboT = 0;
  flash(0.4); drone.shake = 0.7; audio.hit();
  popup(`-${d} HULL`, 'dmg');
  fx.burst(drone.pos, [1.4, 0.35, 0.1], 26, 10, 0.35, 0.6);
  if (run.hp <= 0) {
    for (let k = 0; k < 3; k++) fx.burst(drone.pos, k ? [1.4, 0.6, 0.15] : [0.3, 0.9, 1.2], 70, 18 + k * 6, 0.5, 1.2);
    audio.bossBoom();
    gameOver();
  }
  return true;
}

function collectEcho(b) {
  const res = archive.add(b.piece);
  run.echoes++; L.echoes++;
  addScore(500 + 100 * (run.sector - 1), 'ECHO', 'echo');
  audio.beacon();
  fx.burst(new THREE.Vector3(b.x, b.y, b.z), [0.75, 0.3, 1.1], 60, 14, 0.45, 1.0);
  $('echoTitle').textContent = `${b.piece.story.title} · FRAGMENT ${b.piece.index + 1} · ${archive.progress(b.piece.story)}/${b.piece.story.pieces.length} FOUND`;
  $('echoSrc').textContent = b.piece.story.source;
  $('echoText').textContent = b.piece.story.pieces[b.piece.index];
  show('echoPanel', true); game.echoT = 9;
  if (res.completed) {
    run.score += 2500;
    toast('STORY RESTORED', `${res.story.title} — +2500 · read it in the archive [TAB]`, 5);
  }
  if (res.finale) { run.score += 10000; openSecret(); }
}

function usePower() {
  const p = run.power;
  if (!p) { popup('NO POWER-UP', 'near'); return; }
  run.power = null;
  if (p === 'emp') {
    const R = 38;
    audio.emp(); flash(0); drone.shake = 0.4;
    fx.ring(drone.pos, [0.3, 0.7, 1.4], 80, 55, 0.55, 0.7);
    fx.burst(drone.pos, [0.4, 0.8, 1.5], 60, 20, 0.4, 0.6, 0);
    let n = 0;
    for (const s of L.sentinels) if (s.pos.distanceTo(drone.pos) < R) { s.stun = 6; s.calm(); n++; fx.burst(s.pos, [0.4, 0.7, 1.4], 20, 6, 0.3, 0.6); }
    for (const w of L.watchers) if (Math.hypot(w.pos.x - drone.pos.x, w.pos.z - drone.pos.z) < R + w.radius) w.stun = 5;
    const zapped = bolts.destroyWithin(drone.pos, R);
    if (L.warden && L.warden.alive && L.warden.pos.distanceTo(drone.pos) < R + 10) L.warden.stun(4.5);
    popup(`EMP · ${n} STUNNED${zapped ? ` · ${zapped} SHOTS WIPED` : ''}`, 'near');
  } else if (p === 'cloak') {
    run.cloakT = 7; drone.setCloak(true); audio.cloak();
    for (const s of L.sentinels) s.calm();
    popup('CLOAK ENGAGED', 'near');
  } else if (p === 'magnet') {
    run.magnetT = 12; audio.power(); popup('MAGNET ON', 'gold');
  }
}

function doDash() {
  if (drone.dash()) {
    audio.dash();
    fx.burst(drone.pos, [0.3, 0.85, 1.1], 18, 6, 0.3, 0.35, 0);
  }
}

function sectorClear() {
  game.state = 'clear'; document.exitPointerLock?.();
  const c = L.cfg;
  const rows = [
    ['SECTOR BONUS', 1000 * run.sector],
    ['TIME BONUS', Math.max(0, Math.round((c.par - L.time) * 15))],
    ['UNTOUCHED (NO HULL DAMAGE)', L.damageTaken === 0 ? 750 * run.sector : 0],
    ['FULL SWEEP (EVERY SHARD)', L.shards.remaining === 0 ? 2500 : 0],
  ];
  const total = rows.reduce((a, r) => a + r[1], 0);
  run.score += total;
  const healed = Math.min(35, MAX_HP - run.hp);
  run.hp += healed;
  $('clearTitle').textContent = `SECTOR ${pad(run.sector)} CLEARED`;
  $('clearMeta').textContent = `TIME ${fmtTime(L.time)} / PAR ${fmtTime(c.par)} · SHARDS ${L.shards.total - L.shards.remaining}/${L.shards.total} · ECHOES ${L.echoes}${healed ? ` · HULL REPAIRED +${healed}` : ''}`;
  $('clearRows').innerHTML = rows.map(([k, v]) => `<div class="${v ? '' : 'zero'}"><span>${k}</span><b>+${v}</b></div>`).join('')
    + `<div class="total"><span>SECTOR TOTAL</span><b>+${total}</b></div>`;
  let text;
  if (run.story >= LOGS.length && !run.endingShown) { run.endingShown = true; text = ENDING; }
  else text = TRANSMISSIONS[(run.sector - 1) % TRANSMISSIONS.length];
  $('clearBody').textContent = '';
  typing = { el: $('clearBody'), text, shown: 0, clock: 0 };
  $('btnNext').textContent = `DESCEND → SECTOR ${pad(run.sector + 1)}${sectorConfig(run.sector + 1).boss ? ' (WARDEN)' : ''}`;
  show('clear', true); audio.ending();
}

function nextSector() {
  if (finishTyping()) return;
  show('clear', false); typing = null;
  run.sector++;
  buildLevel(run.sector, seedFor(run.sector, run.mode));
  beginSector();
}

function gameOver() {
  game.state = 'over'; document.exitPointerLock?.();
  drone.setCloak(false);
  const entry = { score: run.score, sector: run.sector, date: todayKey, mode: run.mode };
  scores.push(entry); scores.sort((a, b) => b.score - a.score); scores = scores.slice(0, 10);
  saveJSON(SCORES_KEY, scores);
  const rank = scores.indexOf(entry);
  const isBest = run.score > best;
  best = Math.max(best, run.score);
  $('overScore').textContent = pad(run.score, 7);
  $('overBest').classList.toggle('on', isBest);
  $('overBestVal').textContent = pad(best, 7);
  $('overSector').textContent = pad(run.sector);
  $('overNodes').textContent = run.nodes;
  $('overShards').textContent = run.shards;
  $('overEchoes').textContent = run.echoes;
  $('overTime').textContent = fmtTime(run.time);
  $('overMode').textContent = run.mode === 'daily' ? `DAILY RUN · ${todayKey}` : 'SALVAGE LINK TERMINATED';
  renderTop($('overTop'), rank);
  show('copied', false);
  show('over', true); audio.over();
  refreshMenu();
}

function retry() { startGame(run ? run.mode : 'normal'); }

function toMenu() {
  ['over', 'pause', 'clear', 'log', 'archive', 'settings'].forEach((id) => show(id, false));
  typing = null; document.exitPointerLock?.();
  drone.setCloak(false);
  game.state = 'menu'; hud.classList.remove('on');
  show('start', true); refreshMenu();
}

function togglePause() {
  if (game.state === 'play') { game.state = 'pause'; show('pause', true); document.exitPointerLock?.(); }
  else if (game.state === 'pause') { game.state = 'play'; show('pause', false); lockPointer(); }
}

function openArchive(from) {
  game.returnTo = from; game.state = 'archive';
  if (from === 'play') document.exitPointerLock?.();
  if (from === 'pause') show('pause', false);
  if (from === 'menu') show('start', false);
  $('archiveBody').innerHTML = archive.render();
  $('archiveCount').textContent = `${archive.count}/${archive.total} FRAGMENTS`;
  show('archive', true);
}
function closeArchive() {
  show('archive', false);
  const back = game.returnTo || 'menu';
  game.state = back === 'play' ? 'pause' : back;
  if (game.state === 'pause') show('pause', true);
  if (game.state === 'menu') show('start', true);
}
function openSettings(from) {
  game.returnTo = from; game.state = 'settings';
  if (from === 'pause') show('pause', false);
  if (from === 'menu') show('start', false);
  $('setQuality').value = settings.quality; $('setSens').value = settings.sens; $('setInvert').checked = settings.invertY;
  $('setMusic').value = settings.music; $('setSfx').value = settings.sfx;
  $('infoDaily').textContent = todayKey;
  $('infoSaved').textContent = `${archive.count}/${archive.total} archive fragments · ${scores.length} top run${scores.length === 1 ? '' : 's'}`;
  show('settings', true);
}
function closeSettings() {
  show('settings', false);
  game.state = game.returnTo || 'menu';
  if (game.state === 'pause') show('pause', true);
  if (game.state === 'menu') show('start', true);
}
function openSecret() {
  game.returnTo = game.state; game.state = 'secret'; document.exitPointerLock?.();
  $('secretBody').textContent = '';
  typing = { el: $('secretBody'), text: SECRET_ENDING, shown: 0, clock: 0 };
  show('secret', true); audio.ending();
}
function closeSecret() {
  if (finishTyping()) return;
  typing = null; show('secret', false);
  game.state = game.returnTo === 'play' ? 'play' : game.returnTo || 'play';
  if (game.state === 'play') lockPointer();
}

async function shareResult() {
  const text = `UNDERCROFT NINE${run.mode === 'daily' ? ` · DAILY ${todayKey}` : ''}\nScore ${pad(run.score, 7)} · Sector ${run.sector} · ${run.nodes} nodes · ${run.echoes} echoes · ${fmtTime(run.time)}`;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  show('copied', true);
}

function handleAction(code) {
  if (code === 'KeyM') { toast(audio.toggleMute() ? 'AUDIO OFF' : 'AUDIO ON', '', 1.2); return; }
  const confirm = code === 'Enter' || code === 'Confirm';
  switch (game.state) {
    case 'menu': if (confirm) startGame('normal'); else if (code === 'Tab') openArchive('menu'); break;
    case 'log': if (confirm || code === 'KeyR' || code === 'Escape') closeLog(); break;
    case 'play':
      if ((code === 'KeyR' || code === 'Confirm') && game.near) openLog(game.near);
      else if (code === 'KeyQ') doDash();
      else if (code === 'KeyF') usePower();
      else if (code === 'KeyP' || code === 'Escape') togglePause();
      else if (code === 'Tab') openArchive('play');
      break;
    case 'pause':
      if (code === 'KeyP' || code === 'Escape' || confirm) togglePause();
      else if (code === 'Tab') openArchive('pause');
      break;
    case 'archive': if (code === 'Tab' || code === 'Escape' || confirm) closeArchive(); break;
    case 'settings': if (code === 'Escape' || confirm) closeSettings(); break;
    case 'clear': if (confirm || code === 'KeyR') nextSector(); break;
    case 'over': if (confirm) retry(); break;
    case 'secret': if (confirm) closeSecret(); break;
  }
}
addEventListener('keydown', (e) => { if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) handleAction(e.code); });
// safety net: if a browser shortcut tries to close the tab mid-run, ask before throwing the run away
addEventListener('beforeunload', (e) => {
  if (['play', 'pause', 'log', 'clear', 'archive', 'settings', 'secret'].includes(game.state) && run && run.score > 0) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.state === 'play' && lockedOnce) togglePause();
  if (document.pointerLockElement) lockedOnce = true;
});
let lockedOnce = false;
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') togglePause(); });

$('btnStart').addEventListener('click', () => startGame('normal'));
$('btnDaily').addEventListener('click', () => startGame('daily'));
$('btnArchive').addEventListener('click', () => openArchive('menu'));
$('log').addEventListener('click', closeLog);
$('btnNext').addEventListener('click', nextSector);
$('clear').addEventListener('click', (e) => { if (e.target === $('clear') || e.target.closest('.body')) finishTyping(); });
$('btnRetry').addEventListener('click', retry);
$('btnShare').addEventListener('click', shareResult);
$('btnMenu').addEventListener('click', toMenu);
$('btnResume').addEventListener('click', togglePause);
$('btnPauseArchive').addEventListener('click', () => openArchive('pause'));
$('btnPauseSettings').addEventListener('click', () => openSettings('pause'));
$('btnQuit').addEventListener('click', () => { show('pause', false); gameOver(); });
$('btnArchiveClose').addEventListener('click', closeArchive);
$('btnSettingsClose').addEventListener('click', closeSettings);
$('gear').addEventListener('click', () => { if (game.state === 'menu' || game.state === 'pause') openSettings(game.state); });
$('btnSecret').addEventListener('click', closeSecret);
canvas.addEventListener('click', () => { if (game.state === 'play') lockPointer(); });
$('setQuality').addEventListener('change', (e) => { settings.quality = e.target.value; saveSettings(); applyQuality(); });
$('setSens').addEventListener('input', (e) => { settings.sens = +e.target.value; saveSettings(); });
$('setInvert').addEventListener('change', (e) => { settings.invertY = e.target.checked; saveSettings(); });
$('setMusic').addEventListener('input', (e) => { settings.music = +e.target.value; saveSettings(); audio.setVolumes(settings.music, settings.sfx); });
$('setSfx').addEventListener('input', (e) => { settings.sfx = +e.target.value; saveSettings(); audio.setVolumes(settings.music, settings.sfx); });

function hasLOS(a, b) {
  const d = a.distanceTo(b), n = Math.ceil(d / 1.5);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (L.city.pointBlocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, 0)) return false;
  }
  return true;
}

run = newRun('normal');
buildLevel(1, seedFor(1, 'normal'));
refreshMenu();
const clock = new THREE.Clock();
let now = 0, menuR = 40;
const _tmp = new THREE.Vector3();
const trails = [new Ribbon(scene, [0.08, 0.32, 0.42]), new Ribbon(scene, [0.08, 0.32, 0.42])];

function tick() {
  requestAnimationFrame(tick);
  input.pollPad();
  step(Math.min(clock.getDelta(), 0.05));
}

function step(dt) {
  const t = (now += dt);
  frame++;
  const { city, terminals, sentinels, watchers, shards, beacons, powerups, core, traffic, cfg, warden } = L;
  city.shared.uTime.value = t;
  const st = game.state, playing = st === 'play', frozen = st === 'pause' || st === 'archive' || st === 'settings' || st === 'secret';
  $('touch').classList.toggle('play', playing);
  $('gear').classList.toggle('on', st === 'menu' || st === 'pause');

  if (st === 'menu') {
    const a = t * 0.06 + 0.6, y = 30 + Math.sin(t * 0.2) * 6;
    let r = 62;
    while (r > 14 && city.pointBlocked(Math.sin(a) * r, y, Math.cos(a) * r, 2.5)) r -= 2;
    menuR += (r - menuR) * Math.min(1, dt * 1.5);
    camera.position.set(Math.sin(a) * menuR, y, Math.cos(a) * menuR);
    camera.lookAt(0, 18, 0);
    city.shared.uPlayer.value.set(0, -500, 0);
    input.look(dt);
  } else if (!frozen) {
    drone.update(dt, t, !playing, input);
    city.shared.uPlayer.value.copy(drone.pos);
  } else input.look(dt);

  const threat = 1 + Math.floor((run ? run.time : 0) / THREAT_PERIOD), thr = threat - 1;
  const mods = { speed: 1 + 0.1 * thr, fire: 1 + 0.15 * thr, bolt: 1 + 0.1 * thr };

  if (!frozen) {
    const target = playing ? drone.pos : null;
    for (const tm of terminals) tm.update(t);
    for (const s of sentinels) s.update(dt, t, target, mods.speed);
    for (const w of watchers) w.update(dt, t, mods.speed);
    shards.update(dt, t, target, run && run.magnetT > 0 ? MAGNET_POWER_R : MAGNET_R);
    beacons.update(dt, t); powerups.update(dt, t);
    core.update(dt, t); traffic.update(dt);
    L.steam.update(dt, camera.position);
    fx.update(dt);
  }

  let seenBy = 0;
  if (playing) {
    const p = drone.pos;
    L.time += dt; run.time += dt;
    game.grace = Math.max(0, game.grace - dt);
    run.invulnT = Math.max(0, run.invulnT - dt);
    run.markedT = Math.max(0, run.markedT - dt);
    if (run.cloakT > 0) { run.cloakT -= dt; if (run.cloakT <= 0) { drone.setCloak(false); popup('CLOAK OFFLINE', 'near'); } }
    if (run.magnetT > 0) run.magnetT -= dt;
    if (run.comboT > 0) { run.comboT -= dt; if (run.comboT <= 0) { run.chain = 0; run.mult = 1; } }

    if (threat > run.threat) {
      run.threat = threat; audio.threat();
      toast(`THREAT LEVEL ${threat}`, 'enemies move faster and fire more often — reinforcements inbound', 5);
      const s = sentinels.spawn(p.x, p.z); s.cool = 3;
    }

    for (const it of shards.collect(p, PICKUP_R)) {
      run.chain++; run.comboT = COMBO_TIME; run.mult = calcMult(); run.shards++;
      addScore(it.gold ? 50 : 10, '', it.gold ? 'gold' : '');
      audio.pickup(run.chain);
      _tmp.set(it.x, it.y ?? it.home, it.z);
      fx.burst(_tmp, it.gold ? [1.3, 0.95, 0.3] : [0.35, 1.0, 1.3], it.gold ? 22 : 12, 7, 0.3, 0.45, 0);
    }
    const echo = beacons.collect(p, 4.5);
    if (echo) collectEcho(echo);
    const pu = powerups.collect(p, 3.6, (type) => (type === 'repair' ? run.hp < MAX_HP : !run.power));
    if (pu) {
      fx.burst(_tmp.set(pu.x, pu.y, pu.z), POWER[pu.type].color, 30, 10, 0.4, 0.6);
      if (pu.type === 'repair') { const h = Math.min(30, MAX_HP - run.hp); run.hp += h; popup(`+${h} HULL`, 'heal'); audio.repair(); }
      else { run.power = pu.type; popup(`${POWER[pu.type].label} READY — PRESS F`, 'gold'); audio.power(); }
    }

    let bestT = null, bestD = Infinity;
    for (const tm of terminals) {
      if (tm.collected) continue;
      const d = Math.hypot(tm.x - p.x, tm.z - p.z, p.y * 0.5);
      if (d < bestD) { bestD = d; bestT = tm; }
    }
    const strength = bestT ? Math.max(0, 1 - bestD / 150) : 0;
    game.near = bestT && bestD < 7 ? bestT : null;
    const lit = Math.round(strength * 8);
    bars.forEach((b, i) => b.classList.toggle('on', i < lit));
    pingTimer -= dt;
    if (bestT && strength > 0.45 && pingTimer <= 0) { audio.ping(strength); pingTimer = 1.4 - 1.28 * ((strength - 0.45) / 0.55); }
    if (game.near) { $('prompt').innerHTML = input.usingTouch ? '<b>JACK</b>TAP TO JACK INTO NODE' : '<b>R</b>JACK INTO NODE'; $('prompt').classList.add('on'); }
    else $('prompt').classList.remove('on');

    const cloaked = run.cloakT > 0, exposed = game.grace <= 0 && !cloaked;
    for (const w of watchers) {
      const inS = exposed && w.stun <= 0 && Math.hypot(w.pos.x - p.x, w.pos.z - p.z) < w.radius;
      if (inS) run.markedT = 2.5;
      w.alert += ((inS ? 1 : 0) - w.alert) * Math.min(1, dt * 6);
    }
    chargeTimer -= dt;
    for (const s of sentinels) {
      s.cool -= dt;
      if (s.stun > 0) { s.alert *= 0.9; continue; }
      const d = s.pos.distanceTo(p);
      const sees = exposed && d < cfg.sight && hasLOS(s.eyePos(), p);
      if (sees) s.spot(p);
      else if (run.markedT > 0 && exposed && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 60) s.hunt = Math.max(s.hunt, 1.5);
      s.alert += ((sees ? 1 : 0) - s.alert) * Math.min(1, dt * 6);
      const windup = cfg.windup / mods.fire;
      if (sees) {
        seenBy++;
        if (s.aim === 0 && chargeTimer <= 0) { audio.charge(); chargeTimer = 0.5; }
        s.aim += dt; s.aimFrac = Math.min(1, s.aim / windup);
        if (s.aim >= windup && s.cool <= 0) {
          const from = s.eyePos().clone();
          bolts.fire(from, _tmp.copy(p).sub(from).normalize(), cfg.boltSpeed * mods.bolt, cfg.boltDamage);
          audio.shoot(d);
          s.cool = (cfg.fireInterval / mods.fire) * (run.markedT > 0 ? 0.6 : 1);
          s.aim = 0; s.aimFrac = 0;
        }
      } else { s.aim = Math.max(0, s.aim - dt * 2); s.aimFrac = Math.min(1, s.aim / windup); }
    }
    if (seenBy) { warnTimer -= dt; if (warnTimer <= 0) { audio.warn(); warnTimer = 0.6; } }

    if (warden && warden.alive) {
      const los = (a, b) => !cloaked && game.grace <= 0 && hasLOS(a, b);
      for (const e of warden.update(dt, t, p, DRONE_RADIUS, los, mods.speed)) {
        if (e.type === 'volley') audio.shoot(warden.pos.distanceTo(p) * 0.5);
        else if (e.type === 'vent') popup('COOLANT VENTING — HIT THE GREEN PODS', 'heal');
        else if (e.type === 'pod') { addScore(1500, 'COOLANT POD', 'node'); audio.bonk(30); audio.power(); drone.shake = 0.5; }
        else if (e.type === 'ram') { damage(e.dmg); drone.vel.add(_tmp.copy(p).sub(e.pos).normalize().multiplyScalar(26)); }
        else if (e.type === 'dead') {
          addScore(6000, 'WARDEN DOWN', 'node'); audio.bossBoom(); drone.shake = 1;
          toast('THE WARDEN FALLS', L.found < L.terminals.length ? 'recover the remaining nodes to open the uplink' : 'the core shield is down', 5);
          tryActivateCore(); setObjective();
        }
      }
    }

    bolts.update(dt, city, p, DRONE_RADIUS * 0.8, {
      hit: (b) => {
        if (drone.dashT > 0) return false; // dash i-frames: the bolt passes through
        if (game.grace > 0) { fx.burst(b.pos, [1, 0.85, 0.3], 10, 5, 0.3, 0.3); return true; }
        damage(b.dmg); return true;
      },
      nearMiss: (b) => {
        if (game.state !== 'play') return;
        run.nearMisses++; addScore(40, b.phased ? 'PHASED' : 'CLOSE CALL', 'near'); audio.nearMiss();
      },
    });

    const dc = p.distanceTo(core.pos);
    if (core.shielded && dc < 10.5) {
      const n = _tmp.copy(p).sub(core.pos).normalize();
      p.copy(core.pos).addScaledVector(n, 10.5); drone.vel.addScaledVector(n, 18);
      if (warnTimer <= 0) { popup('CORE SHIELDED', 'dmg'); warnTimer = 1; }
    }
    if (game.state === 'play' && core.active && dc < 8.5) sectorClear();

    drone.lowHp = run.hp < 35 ? 1 - run.hp / 35 : 0;
    const trailK = cloaked ? 0 : clamp((drone.speed - 10) / 30, 0, 1);
    trails.forEach((r, i) => r.update(drone.podWorld(2 + i, _tmp), camera.position, trailK));
    if (drone.lowHp > 0 && Math.random() < drone.lowHp * 0.4) fx.spawn(p.x, p.y + 0.2, p.z, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, [1.3, 0.5, 0.1], 0.22, 0.5, 1, -6);
  } else if (!frozen) {
    for (const s of sentinels) { s.alert *= 0.9; s.aim = 0; s.aimFrac = 0; }
    for (const w of watchers) w.alert *= 0.9;
    if (warden && warden.alive && st !== 'menu') warden.update(dt, t, null, DRONE_RADIUS, () => false, 1);
    $('prompt').classList.remove('on');
  }

  if (!playing && !frozen) trails.forEach((r) => r.update(drone.podWorld(0, _tmp), camera.position, 0));
  for (const r of trails) r.mesh.visible = st !== 'menu';

  drone.mesh.visible = st !== 'menu' && !(game.grace > 0 && Math.sin(t * 28) > 0.3);

  const want = playing ? clamp(Math.max(seenBy ? 0.85 : 0, run.markedT > 0 ? 0.6 : 0, warden && warden.alive ? 0.6 : 0, drone.lowHp * 0.7), 0, 1) : 0;
  intensity += (want - intensity) * Math.min(1, dt * 1.5);
  audio.setIntensity(intensity);

  if (typing && typing.shown < typing.text.length) {
    typing.clock += dt * 70;
    const n = Math.min(typing.text.length, Math.floor(typing.clock));
    if (n !== typing.shown) { typing.shown = n; typing.el.textContent = typing.text.slice(0, n); if (frame % 3 === 0) audio.type(); }
  }

  const lowPulse = drone.lowHp > 0 ? drone.lowHp * (0.5 + 0.3 * Math.sin(t * 8)) : 0;
  $('danger').style.opacity = playing ? Math.max(lowPulse, run.markedT > 0 ? 0.25 + 0.15 * Math.sin(t * 14) : 0, seenBy ? 0.12 : 0) : 0;
  $('speed').style.opacity = playing ? clamp((drone.speed - 28) / 18, 0, 0.9) + drone.fovKick * 0.4 : 0;
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('on'); }
  if (game.echoT > 0) { game.echoT -= dt; if (game.echoT <= 0) show('echoPanel', false); }
  if (st !== 'menu' && run && frame % 2 === 0) {
    $('score').textContent = pad(run.score, 7);
    $('mult').textContent = '×' + run.mult;
    $('mult').classList.toggle('hot', run.mult > 1);
    $('comboFill').style.width = Math.max(0, run.comboT / COMBO_TIME) * 100 + '%';
    $('sector').textContent = pad(run.sector);
    $('threat').textContent = run.threat; $('threat').classList.toggle('hot', run.threat > 1);
    $('threatNext').textContent = `· NEXT ${fmtTime(THREAT_PERIOD - (run.time % THREAT_PERIOD))}`;
    $('best').textContent = pad(Math.max(best, run.score), 7);
    const hpF = $('hpFill');
    hpF.style.width = (run.hp / MAX_HP) * 100 + '%';
    hpF.className = run.hp < 30 ? 'low' : run.hp < 60 ? 'mid' : '';
    $('hpVal').textContent = Math.ceil(run.hp);
    $('boostFill').style.width = drone.energy + '%';
    $('boostFill').className = drone.boostLock ? 'lock' : '';
    $('echoCount').textContent = `${archive.count}/${archive.total} · ${L.beacons.remaining} HERE`;
    $('chipMarked').classList.toggle('on', run.markedT > 0);
    $('chipShield').classList.toggle('on', game.grace > 0);
    $('chipCloak').classList.toggle('on', run.cloakT > 0); $('chipCloak').textContent = `CLOAK ${Math.ceil(run.cloakT)}s`;
    $('chipMagnet').classList.toggle('on', run.magnetT > 0); $('chipMagnet').textContent = `MAGNET ${Math.ceil(run.magnetT)}s`;
    $('powerSlot').classList.toggle('has', !!run.power);
    $('powerName').textContent = run.power ? POWER[run.power].label : 'NO POWER-UP';
    $('dashSlot').classList.toggle('cd', drone.dashCD > 0);
    $('dashSlot').lastChild.textContent = drone.dashCD > 0 ? `DASH ${drone.dashCD.toFixed(1)}` : 'DASH';
    const showBoss = !!(warden && warden.alive);
    $('bossbar').classList.toggle('on', showBoss);
    if (showBoss) {
      $('bossFill').style.width = (warden.podsLeft / 3) * 100 + '%';
      $('bossHint').textContent = warden.venting ? 'VENTING — FLY THROUGH A GREEN POD NOW' : `COOLANT PODS ${warden.podsLeft}/3 — DODGE THE VOLLEYS, WAIT FOR THE VENT`;
      $('bossHint').classList.toggle('vent', warden.venting);
    }
  }
  if (st !== 'menu' && frame % 4 === 0) {
    $('alt').textContent = pad(Math.max(0, drone.pos.y).toFixed(0));
    $('spd').textContent = pad(drone.speed.toFixed(0));
    $('clock').textContent = fmtTime(L.time);
    $('par').textContent = fmtTime(cfg.par);
    $('shardCount').textContent = `${shards.total - shards.remaining}/${shards.total}`;
    drawMinimap(t);
  }
  if (frame % 2 === 0) updateIndicators();
  audio.update(dt, st === 'menu' ? 0 : drone.speed);

  composer.render();
}
tick();

// debug / test hook
window.__game = { game, get run() { return run; }, get L() { return L; }, drone, bolts, fx, bloom, renderer, archive, step, handleAction };
