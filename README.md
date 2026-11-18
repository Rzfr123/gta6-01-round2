# Harbor Lights

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Rzfr123/gta6-01-round2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Rzfr123/gta6-01-round2/reward.svg)](https://make.fun/bounty/gta6-01)

An original top-down open-world crime game in the fictional coastal city of
Solmar Bay, built for [make.fun gta6-01](https://make.fun/bounty/gta6-01).
You are Mara Voss, getaway driver: steal cars, outrun the SBPD, and run six
story jobs for fixer Rook and dealer Lena — ending with Dario and his yacht.

## Play

- Walk and drive across 6 districts: Old Docks, Marina Bay, Downtown, Palm
  Heights, Sunset Strip, Central Park (3400x2600 city, traffic + pedestrians).
- Steal any car (E), exit (E). Wanted 0–5 stars: SBPD pursuit, ramming,
  shooting, busted fines ($100); pay-and-spray garage ($200) clears the heat.
- 6-mission story chain with dialogue and cash rewards ($300–$3000).
- Combat on foot (mouse aim, click to shoot) and drive-by from the car.
- HUD with wanted stars, cash, district + clock, HP/armor, speed, mission
  tracker and minimap. Day/night cycle, rain, particles, screen shake,
  synthesized WebAudio SFX + procedural synthwave music (M mute).
- Pause (P), restart (R), autosave to localStorage.

## Run

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — no build step, no network. Canvas 2D, ES modules.
All names, city, story, art and sound are original; nothing from Rockstar.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

License: MIT. See LICENSE.
