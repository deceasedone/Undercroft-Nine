// Sanity checks for the procedural generator, run with `npm test`.
// For many seeds and node counts it verifies that every pickup sits in open air,
// every data node can be approached, and the uplink core is reachable.
import { generateCity, START_CELL, cellCenter, N } from '../src/cityGen.js';

const SEEDS = 40;
const DRONE_R = 1.6;
let failures = 0, checks = 0;
const fail = (seed, msg) => { failures++; if (failures <= 25) console.error(`  ✗ seed ${seed}: ${msg}`); };

for (let seed = 1; seed <= SEEDS; seed++) {
  for (const nodes of [4, 6, 8]) {
    const c = generateCity(seed * 7919 + nodes, { nodes });
    const S = c.grid;

    checks++;
    if (c.terminals.length !== nodes) fail(seed, `expected ${nodes} nodes, got ${c.terminals.length}`);
    for (const t of c.terminals) {
      checks++;
      const i = Math.round(t.x / 16 + (N - 1) / 2), j = Math.round(t.z / 16 + (N - 1) / 2);
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => S[i + a]?.[j + b]?.type === 'street');
      if (!nb) fail(seed, `node at ${t.x},${t.z} has no street neighbour`);
      // the drone must fit somewhere within interaction range (7 m) of the node
      let ok = false;
      for (let a = 0; a < 16 && !ok; a++) for (const r of [3, 4.5, 6]) for (const y of [2, 3.5, 5]) {
        const x = t.x + Math.cos((a / 16) * Math.PI * 2) * r, z = t.z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (!c.pointBlocked(x, y, z, DRONE_R - 0.2)) { ok = true; break; }
      }
      if (!ok) fail(seed, `node at ${t.x},${t.z} cannot be approached`);
    }

    for (const [x, y, z] of c.shards) { checks++; if (c.pointBlocked(x, y, z, 0.3)) fail(seed, `shard inside geometry at ${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`); }
    for (const [x, y, z] of c.beaconSpots) { checks++; if (c.pointBlocked(x, y, z, 1.0)) fail(seed, `beacon spot inside geometry at ${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`); }
    for (const [x, y, z] of c.powerSpots) { checks++; if (c.pointBlocked(x, y, z, 0.8)) fail(seed, `power-up spot inside geometry at ${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`); }

    checks++;
    if (c.pointBlocked(cellCenter(START_CELL[0]), 5, cellCenter(START_CELL[1]), DRONE_R)) fail(seed, 'spawn point is blocked');
    checks++;
    if (c.pointBlocked(0, 16, 6, DRONE_R)) fail(seed, 'core approach is blocked');
  }
}

console.log(`${checks} checks over ${SEEDS * 3} cities — ${failures ? failures + ' FAILED' : 'all passed'}`);
process.exit(failures ? 1 : 0);
