# Undercroft Nine

A 3D cyberpunk flying game that runs in the browser. Pilot a salvage drone through a procedurally generated underground city that has been sealed for thirty-one years and still keeps its neon burning.

Chain data shards for a score multiplier, recover the data nodes, collect torn story fragments from echo beacons, then dive into the core to descend to a harder sector. Sentinels shoot on sight, searchlights mark you for the hunt, and every five minutes the city gets angrier.

Built with **Three.js** and **Vite**. No other runtime dependencies, image files or audio files: the city, models, effects and soundtrack are all generated in code.

## Features

- Procedurally generated city on every run (or a shared **Daily Run** seed)
- Endless sectors with rising difficulty and a boss, the Warden, every 5th sector
- Score multiplier, power-ups (EMP, cloak, magnet), dash with invulnerability frames
- A story told through node logs, plus four torn stories collected across runs, with a secret ending
- Instanced rendering, custom GLSL shaders, bloom, particles
- Fully synthesised WebAudio soundtrack and effects
- Keyboard and mouse, gamepad, and touch controls
- Local top-10 scores, archive progress and settings saved in the browser

## Controls

| Action | Keyboard |
|---|---|
| Fly | W A S D |
| Look | Mouse / arrow keys |
| Climb / dive | Space / E |
| Boost | Shift |
| Dash (dodges shots) | Q |
| Jack into a node | R |
| Use power-up | F |
| Archive / pause / mute | Tab / P / M |

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

## Build and test

```bash
npm run build   # static site in dist/, deployable to any static host
npm test        # generator checks: every node reachable, no pickups inside geometry
```

## Project layout

```
src/main.js      game loop, sectors, combat, scoring, HUD and menus
src/cityGen.js   procedural city, shaders, collision
src/player.js    drone model, flight model, chase camera
src/entities.js  data nodes, sentinels, searchlights, core, traffic, rain
src/pickups.js   shards, echo beacons, power-ups
src/boss.js      the Warden
src/fx.js        particles, enemy bolts, ribbon trails
src/decor.js     hologram ads, steam vents
src/audio.js     synthesised music and sound effects
src/input.js     keyboard, mouse, gamepad and touch input
src/lore.js, src/archive.js   story text and the torn-story archive
```
