// Harbor Lights — the simulation: city, driving, traffic, pedestrians,
// police pursuit, the six-mission story, combat and autosave.
// All original: fictional Solmar Bay, Mara Voss, Rook, Lena, Harlow/Dario.
import {
  BUSTED_FINE, CAR, HARBOR, MISSIONS, PARK, PEDS, PLAYER, POLICE, ROADS_X,
  ROADS_Y, ROAD_W, SAVE_KEY, SPAWN, SPRAY, TRAFFIC, WANTED, WORLD,
} from './config.js';
import { pick, range } from './random.js';

const CAR_NAMES = ['Comet', 'Stallion', 'Bison', 'Vortex', 'Marlin', 'Cactus', 'Dune', 'Falcon'];
const CAR_COLORS = ['#7fb3d5', '#d5a06a', '#8fae8b', '#c9c9c9', '#e07a5f', '#81b29a', '#f2cc8f'];
const TAU = Math.PI * 2;

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
// Push a circle out of a rectangle; returns true when a push happened.
function pushOutOfRect(p, radius, r) {
  const cx = clamp(p.x, r.x, r.x + r.w);
  const cy = clamp(p.y, r.y, r.y + r.h);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 > 0.01) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * radius;
    p.y = cy + (dy / d) * radius;
  } else {
    // Centre inside the rect: push out along the smallest penetration.
    const left = p.x - r.x;
    const right = r.x + r.w - p.x;
    const top = p.y - r.y;
    const bottom = r.y + r.h - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = r.x - radius;
    else if (m === right) p.x = r.x + r.w + radius;
    else if (m === top) p.y = r.y - radius;
    else p.y = r.y + r.h + radius;
  }
  return true;
}

export function districtAt(x, y) {
  if (inRect(x, y, PARK)) return 'Central Park';
  if (y >= 1700) return 'Sunset Strip';
  if (x < 1100 && y < 800) return 'Old Docks';
  if (x >= 1100 && y < 800) return 'Marina Bay';
  if (x < 1700) return 'Downtown';
  return 'Palm Heights';
}

function buildCity(rand) {
  const buildings = [];
  const trees = [];
  const xs = [ROAD_W + 35, ...ROADS_X, WORLD.width - ROAD_W - 35];
  const ys = [ROAD_W + 35, ...ROADS_Y, WORLD.height - ROAD_W - 35];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + ROAD_W / 2 + 12;
      const x1 = xs[i + 1] - ROAD_W / 2 - 12;
      const y0 = ys[j] + ROAD_W / 2 + 12;
      const y1 = ys[j + 1] - ROAD_W / 2 - 12;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      if (rectsOverlap(block, PARK)) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: range(rand, block.x, block.x + block.w), y: range(rand, block.y, block.y + block.h), s: range(rand, 10, 18) });
        }
        continue;
      }
      if (block.x < HARBOR.w + 40) continue; // harbour front stays open.
      const downtown = block.x < 1700 && block.y >= 800 && block.y < 1700;
      const n = rand() < 0.65 ? (rand() < 0.5 ? 1 : 2) : 0;
      for (let b = 0; b < n; b += 1) {
        const w = range(rand, 90, Math.min(230, block.w - 30));
        const h = range(rand, 90, Math.min(200, block.h - 30));
        const bx = range(rand, block.x, block.x + block.w - w);
        const by = range(rand, block.y, block.y + block.h - h);
        buildings.push({
          x: bx, y: by, w, h,
          color: downtown ? '#4d5468' : pick(rand, ['#5a5f6e', '#6b5a4e', '#4e5a66', '#655a6e']),
          roof: pick(rand, ['#7a7f8e', '#8a7a6a', '#6a7a8a']),
          tall: downtown && rand() < 0.5,
        });
      }
      for (let t = 0; t < 3; t += 1) {
        trees.push({ x: range(rand, block.x, block.x + block.w), y: range(rand, block.y, block.y + block.h), s: range(rand, 9, 15) });
      }
    }
  }
  return { buildings, trees };
}

export function createWorld(rand) {
  const { buildings, trees } = buildCity(rand);
  const state = {
    mode: 'title',
    time: 0,
    clockMin: 16 * 60 + 30,
    rain: 0,
    rainTarget: 0,
    weatherT: 30,
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: 0, hp: PLAYER.maxHp, armor: 0,
      inCar: false, car: null, fireT: 0, aimAngle: 0, lastHurt: -99,
    },
    cars: [],
    peds: [],
    enemies: [],
    bullets: [],
    ebullets: [],
    particles: [],
    buildings,
    trees,
    cash: 150,
    wanted: 0,
    kills: 0,
    missionIndex: 0,
    stageIndex: 0,
    dialogue: null,
    message: null,
    messageT: 0,
    camera: { x: 0, y: 0 },
    view: { w: 1280, h: 720 },
    target: { x: 1400, y: 600, label: 'Pick up the package at the Old Docks corner' },
    ratCar: null,
    trafficT: 0,
    policeT: 0,
    sirenT: 0,
    crimeT: 99,
    wantedT: 0,
    pursuitT: 0,
    sprayCooldown: 0,
    saveT: 0,
    shake: 0,
    arrestT: 0,
    stats: { shots: 0, hits: 0 },
    debug: null,
  };
  window.__G = { player: state.player, cars: state.cars, enemies: state.enemies, bullets: state.bullets, camera: state.camera, state };

  function makeCar(x, y, angle, opts) {
    return {
      x, y, angle, speed: 0, color: pick(rand, CAR_COLORS),
      name: pick(rand, CAR_NAMES), hp: 100, dead: false, deadT: 0,
      traffic: false, police: false, rat: false,
      axis: 'y', dir: 1, cruise: range(rand, TRAFFIC.speedMin, TRAFFIC.speedMax),
      shootT: 1,
      ...opts,
    };
  }

  function spawnParkedCars() {
    const spots = [
      [655, 615, 0], [1040, 655, Math.PI], [1440, 1010, 0], [1840, 615, Math.PI],
      [2240, 1450, Math.PI / 2], [2640, 655, 0], [640, 1445, Math.PI / 2],
      [1040, 1845, 0], [1840, 2245, Math.PI], [3040, 1010, Math.PI / 2],
      [2240, 2245, 0], [640, 2245, Math.PI],
    ];
    for (const [x, y, a] of spots) state.cars.push(makeCar(x, y, a, { speed: 0 }));
  }

  function spawnPeds() {
    for (let i = 0; i < PEDS.count; i += 1) {
      const rx = pick(rand, ROADS_X);
      const ry = pick(rand, ROADS_Y);
      const x = clamp(rx + range(rand, -160, 160), 140, WORLD.width - 40);
      const y = clamp(ry + range(rand, -160, 160), 40, WORLD.height - 40);
      state.peds.push({ x, y, tx: x, ty: y, speed: PEDS.walkSpeed, angle: rand() * TAU, flee: 0 });
    }
  }

  function setMessage(text) {
    state.message = text;
    state.messageT = 4;
  }

  function addCrime(level) {
    state.wanted = Math.min(WANTED.max, Math.max(state.wanted, level));
    state.crimeT = 0;
  }

  function saveNow() {
    try {
      const p = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp),
        armor: Math.round(p.armor), cash: state.cash, mission: state.missionIndex,
        stage: state.stageIndex, kills: state.kills, wanted: state.wanted,
        clockMin: Math.round(state.clockMin), inCar: p.inCar,
      }));
    } catch { /* storage off: the save lasts this visit only */ }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || typeof s.x !== 'number') return false;
      const p = state.player;
      p.x = clamp(s.x, 140, WORLD.width - 40);
      p.y = clamp(s.y, 40, WORLD.height - 40);
      p.hp = clamp(s.hp ?? 100, 1, PLAYER.maxHp);
      p.armor = clamp(s.armor ?? 0, 0, PLAYER.maxArmor);
      state.cash = s.cash ?? 150;
      state.missionIndex = clamp(s.mission ?? 0, 0, MISSIONS.length - 1);
      state.stageIndex = s.stage ?? 0;
      state.kills = s.kills ?? 0;
      state.wanted = clamp(s.wanted ?? 0, 0, WANTED.max);
      state.clockMin = s.clockMin ?? 18 * 60;
      if (s.inCar) {
        const car = makeCar(p.x + 30, p.y, 0, {});
        state.cars.push(car);
        enterCar(car);
      }
      startMission(state.missionIndex, true);
      state.stageIndex = clamp(s.stage ?? 0, 0, MISSIONS[state.missionIndex].stages.length - 1);
      setupStage();
      return true;
    } catch {
      return false;
    }
  }

  function enterCar(car) {
    const p = state.player;
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    car.traffic = false;
    car.police = false;
  }

  function exitCar() {
    const p = state.player;
    if (!p.car) return;
    const car = p.car;
    p.inCar = false;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.x = clamp(p.x, 140, WORLD.width - 40);
    p.y = clamp(p.y, 40, WORLD.height - 40);
  }

  function spawnEnemies(x, y, count, boss) {
    state.enemies = [];
    for (let i = 0; i < count; i += 1) {
      const isBoss = boss && i === count - 1;
      const a = (i / count) * TAU;
      const ex = clamp(x + Math.cos(a) * range(rand, 130, 260), 140, WORLD.width - 40);
      const ey = clamp(y + Math.sin(a) * range(rand, 130, 260), 40, WORLD.height - 40);
      state.enemies.push({
        x: ex, y: ey, hp: isBoss ? 300 : 60, angle: a, shootT: range(rand, 0.5, 1.5),
        speed: 62, kind: isBoss ? 'dario' : 'goon', name: isBoss ? 'Dario' : 'Harlow crew',
      });
    }
  }

  function spawnRatCar() {
    const car = makeCar(1000, 1000, 0, { rat: true, cruise: 380, hp: 100 });
    state.cars.push(car);
    state.ratCar = car;
    return car;
  }

  function currentMission() { return MISSIONS[state.missionIndex]; }
  function currentStage() {
    const m = currentMission();
    return m ? m.stages[state.stageIndex] : null;
  }

  function setupStage() {
    const stage = currentStage();
    if (!stage) return;
    if (stage.kind === 'goto' || stage.kind === 'spray') {
      state.target = { x: stage.x, y: stage.y, label: stage.label };
    } else if (stage.kind === 'kill') {
      spawnEnemies(stage.x, stage.y, stage.count, !!stage.boss);
      state.target = { x: stage.x, y: stage.y, label: stage.label };
    } else if (stage.kind === 'chase') {
      spawnRatCar();
      state.target = { x: 1000, y: 1000, label: stage.label };
    }
    if (stage.wanted) addCrime(stage.wanted);
  }

  function startMission(index, skipIntro) {
    state.missionIndex = index;
    state.stageIndex = 0;
    const mission = MISSIONS[index];
    if (!mission) return;
    setupStage();
    if (!skipIntro) state.dialogue = { lines: mission.intro, i: 0 };
  }

  function advanceDialogue() {
    if (!state.dialogue) return;
    state.dialogue.i += 1;
    if (state.dialogue.i >= state.dialogue.lines.length) state.dialogue = null;
  }

  function completeMission() {
    const mission = currentMission();
    state.cash += mission.reward;
    setMessage(`MISSION COMPLETE — ${mission.name}  +$${mission.reward}`);
    saveNow();
    state.missionIndex += 1;
    if (state.missionIndex >= MISSIONS.length) {
      state.mode = 'done';
      state.dialogue = null;
      saveNow();
      return;
    }
    startMission(state.missionIndex, false);
  }

  function advanceStage() {
    state.stageIndex += 1;
    const mission = currentMission();
    if (state.stageIndex >= mission.stages.length) completeMission();
    else setupStage();
  }

  function hurtPlayer(amount, source) {
    const p = state.player;
    let rest = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, rest);
      p.armor -= absorbed;
      rest -= absorbed;
    }
    p.hp -= rest;
    p.lastHurt = state.time;
    state.shake = Math.max(state.shake, 6);
    if (p.hp <= 0) {
      p.hp = 0;
      state.mode = source === 'arrest' ? 'busted' : 'dead';
      state.dialogue = null;
    }
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = rand() * TAU;
      const s = range(rand, speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(rand, 0.3, 0.8), max: 0.8, color, size: range(rand, 2, 5) });
    }
  }

  function firePlayerBullet(aimWorldX, aimWorldY, audio) {
    const p = state.player;
    if (p.fireT > 0) return;
    p.fireT = PLAYER.fireInterval;
    const ox = p.inCar ? p.car.x : p.x;
    const oy = p.inCar ? p.car.y : p.y;
    const a = angleTo(ox, oy, aimWorldX, aimWorldY) + range(rand, -0.02, 0.02);
    state.bullets.push({
      x: ox + Math.cos(a) * 24, y: oy + Math.sin(a) * 24,
      vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
      life: 1.1, dmg: PLAYER.bulletDamage,
    });
    p.aimAngle = a;
    state.stats.shots += 1;
    state.shake = Math.max(state.shake, 2);
    burst(ox + Math.cos(a) * 26, oy + Math.sin(a) * 26, '#ffd34d', 3, 120);
    if (state.wanted < 1) addCrime(1);
    state.crimeT = 0;
    if (audio) audio.sfx('shoot');
  }

  function collideCarsWithBuildings(car) {
    // A car's collision circle (18) is smaller than its length, so a car
    // can brush a wall without wedging: a scrape only costs a little speed,
    // and a hard push costs more. The old 24-radius + 0.6x every step
    // pinned any car that touched a wall at ~2 km/h.
    for (const b of state.buildings) {
      const bx = car.x;
      const by = car.y;
      if (pushOutOfRect(car, 18, b)) {
        const pushed = Math.hypot(car.x - bx, car.y - by);
        car.speed *= pushed > 4 ? 0.8 : 0.97;
      }
    }
  }

  function stepPlayer(dt, ctl, audio) {
    const p = state.player;
    p.fireT = Math.max(0, p.fireT - dt);
    if (p.inCar && p.car) {
      const car = p.car;
      const throttle = ctl.up ? 1 : 0;
      const braking = ctl.down ? 1 : 0;
      if (throttle) car.speed += CAR.accel * dt;
      if (braking) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.7) * dt;
      car.speed -= car.speed * CAR.drag * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxForward);
      // Steering authority stays at 0.4 or better while throttling or braking,
      // so a slow car can still turn out of a dead end.
      const authority = (throttle || braking)
        ? Math.max(CAR.minSteer, Math.min(1, Math.abs(car.speed) / 200))
        : Math.min(1, Math.abs(car.speed) / 200);
      const steer = (ctl.left ? -1 : 0) + (ctl.right ? 1 : 0);
      if (steer !== 0 && Math.abs(car.speed) > 4) {
        car.angle += steer * CAR.steerRate * authority * dt * (car.speed >= 0 ? 1 : -1);
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 130, WORLD.width - 30);
      car.y = clamp(car.y, 30, WORLD.height - 30);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (audio) audio.setEngine(Math.abs(car.speed) / CAR.maxForward);
      if (ctl.interact) {
        exitCar();
        if (audio) audio.sfx('steal');
      }
    } else {
      const m = ctl.move;
      const len = Math.hypot(m.x, m.y);
      if (len > 0) {
        const nx = m.x / len;
        const ny = m.y / len;
        p.x += nx * PLAYER.walkSpeed * dt;
        p.y += ny * PLAYER.walkSpeed * dt;
        p.angle = Math.atan2(ny, nx);
      }
      p.x = clamp(p.x, 140, WORLD.width - 40);
      p.y = clamp(p.y, 40, WORLD.height - 40);
      if (audio) audio.setEngine(0);
      if (ctl.interact) {
        let best = null;
        let bestD = 62;
        for (const car of state.cars) {
          if (car.dead) continue;
          const d = dist(p.x, p.y, car.x, car.y);
          if (d < bestD) { bestD = d; best = car; }
        }
        if (best) {
          enterCar(best);
          addCrime(WANTED.stealCar);
          setMessage(`Stole a ${best.name} — SBPD is watching`);
          if (audio) audio.sfx('steal');
        }
      }
    }
    // Aim from the mouse (screen space) into the world.
    const aimX = state.camera.x + ctl.aim.x;
    const aimY = state.camera.y + ctl.aim.y;
    if (!p.inCar) p.aimAngle = angleTo(p.x, p.y, aimX, aimY);
    if (ctl.firing) firePlayerBullet(aimX, aimY, audio);
    // Buildings stop the player, on foot or in a car.
    for (const b of state.buildings) {
      if (p.inCar && p.car) collideCarsWithBuildings(p.car);
      else pushOutOfRect(p, PLAYER.radius, b);
    }
    if (p.inCar && p.car) { p.x = p.car.x; p.y = p.car.y; }
  }

  function stepTraffic(dt) {
    state.trafficT += dt;
    if (state.trafficT >= TRAFFIC.spawnEvery && state.cars.filter((c) => !c.dead).length < TRAFFIC.maxTotalCars) {
      state.trafficT = 0;
      const vertical = rand() < 0.5;
      let car;
      if (vertical) {
        const rx = pick(rand, ROADS_X);
        const fromTop = rand() < 0.5;
        car = makeCar(rx, fromTop ? 20 : WORLD.height - 20, fromTop ? Math.PI / 2 : -Math.PI / 2,
          { traffic: true, axis: 'y', dir: fromTop ? 1 : -1 });
      } else {
        const ry = pick(rand, ROADS_Y);
        const fromLeft = rand() < 0.5;
        car = makeCar(fromLeft ? 140 : WORLD.width - 20, ry, fromLeft ? 0 : Math.PI,
          { traffic: true, axis: 'x', dir: fromLeft ? 1 : -1 });
      }
      let clear = true;
      for (const c of state.cars) if (!c.dead && dist(c.x, c.y, car.x, car.y) < 140) clear = false;
      if (clear) state.cars.push(car);
    }
    for (const car of state.cars) {
      if (!car.traffic || car.dead) continue;
      // Slow down for the car ahead.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = car.axis === 'x' ? dx * car.dir : dy * car.dir;
        const side = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
        if (ahead > 0 && ahead < 70 && side < 30) { blocked = true; break; }
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // At an intersection, sometimes turn onto the cross road.
      const onX = ROADS_X.find((rx) => Math.abs(car.x - rx) < 14);
      const onY = ROADS_Y.find((ry) => Math.abs(car.y - ry) < 14);
      if (onX !== undefined && onY !== undefined && rand() < dt * 0.5) {
        if (car.axis === 'y') {
          car.axis = 'x';
          car.dir = rand() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? 0 : Math.PI;
          car.y = onY;
        } else {
          car.axis = 'y';
          car.dir = rand() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.x = onX;
        }
      }
      if (car.x < 100 || car.x > WORLD.width - 10 || car.y < 10 || car.y > WORLD.height - 10) {
        car.dead = true;
        car.deadT = 99;
      }
      collideCarsWithBuildings(car);
    }
    // Wrecks fade out after a while; the list is pruned to stay small.
    for (const c of state.cars) if (c.dead) c.deadT += dt;
    state.cars = state.cars.filter((c) => !c.dead || c.deadT < 12);
    // Car-car shoving: nobody drives through anybody else.
    const live = state.cars.filter((c) => !c.dead);
    for (let i = 0; i < live.length; i += 1) {
      for (let j = i + 1; j < live.length; j += 1) {
        const a = live[i];
        const b = live[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 46) {
          const push = (46 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          if (a === state.player.car || b === state.player.car) {
            const other = a === state.player.car ? b : a;
            if (other.traffic && Math.abs(state.player.car.speed) > 120) {
              state.crimeT = 0;
              if (state.wanted < WANTED.max) state.wanted = Math.min(WANTED.max, state.wanted + 1);
              setMessage('Hit-and-run — SBPD noticed');
            }
            // Mara shoves through traffic; the other car takes the speed loss.
            if (a === state.player.car) { a.speed *= 0.92; b.speed *= 0.6; }
            else { b.speed *= 0.92; a.speed *= 0.6; }
          }
        }
      }
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = angleTo(p.x, p.y, ped.x, ped.y);
        ped.x += Math.cos(a) * PEDS.walkSpeed * 2.2 * dt;
        ped.y += Math.sin(a) * PEDS.walkSpeed * 2.2 * dt;
      } else {
        const d = dist(ped.x, ped.y, ped.tx, ped.ty);
        if (d < 12) {
          const rx = pick(rand, ROADS_X);
          const ry = pick(rand, ROADS_Y);
          ped.tx = clamp(rx + range(rand, -200, 200), 140, WORLD.width - 40);
          ped.ty = clamp(ry + range(rand, -200, 200), 40, WORLD.height - 40);
        } else {
          const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
          ped.angle = a;
          ped.x += Math.cos(a) * ped.speed * dt;
          ped.y += Math.sin(a) * ped.speed * dt;
        }
      }
      ped.x = clamp(ped.x, 140, WORLD.width - 40);
      ped.y = clamp(ped.y, 40, WORLD.height - 40);
      for (const b of state.buildings) pushOutOfRect(ped, 12, b);
    }
  }

  function spawnPoliceCar() {
    const p = state.player;
    for (let tries = 0; tries < 8; tries += 1) {
      const rx = pick(rand, ROADS_X);
      const ry = pick(rand, ROADS_Y);
      if (dist(rx, ry, p.x, p.y) > 650 && dist(rx, ry, p.x, p.y) < 1100) {
        const car = makeCar(rx, ry, angleTo(rx, ry, p.x, p.y), {
          police: true, hp: 120, color: '#2f6fd0', name: 'SBPD Interceptor',
        });
        state.cars.push(car);
        return;
      }
    }
  }

  function stepPolice(dt, audio) {
    const p = state.player;
    const cops = state.cars.filter((c) => c.police && !c.dead);
    state.policeT += dt;
    if (state.wanted > 0 && cops.length < state.wanted && state.policeT > 1.5) {
      state.policeT = 0;
      spawnPoliceCar();
    }
    if (state.wanted === 0) {
      for (const cop of cops) {
        if (dist(cop.x, cop.y, p.x, p.y) > 900) { cop.dead = true; cop.deadT = 99; }
      }
    }
    state.sirenT += dt;
    if (cops.length > 0 && state.sirenT > 2.2) {
      state.sirenT = 0;
      if (audio) audio.sfx('siren');
    }
    let arrestHold = 0;
    for (const cop of cops) {
      const d = dist(cop.x, cop.y, p.x, p.y);
      const want = angleTo(cop.x, cop.y, p.x, p.y);
      const diff = wrapAngle(want - cop.angle);
      cop.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
      // After a ram the cop backs off for a moment instead of grinding
      // on the player's bumper — a chase, not a shredder.
      cop.ramT = (cop.ramT ?? 0) - dt;
      const targetSpeed = cop.ramT > 0 ? 140 : Math.min(POLICE.chaseSpeed, d * 1.2 + 120);
      cop.speed += clamp(targetSpeed - cop.speed, -300 * dt, 240 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.x = clamp(cop.x, 130, WORLD.width - 30);
      cop.y = clamp(cop.y, 30, WORLD.height - 30);
      // Police cars collide with buildings too — no driving through walls.
      collideCarsWithBuildings(cop);
      if (d < 52) {
        if (p.inCar) {
          if (cop.ramT <= 0) {
            // One solid hit per ram, then the cop peels away: 6 hp a hit.
            hurtPlayer(POLICE.ramHit, 'ram');
            cop.ramT = POLICE.ramCooldownSec;
            cop.speed *= 0.5;
            burst(cop.x, cop.y, '#ffd34d', 6, 180);
            if (audio) audio.sfx('crash');
          }
          p.car.speed *= (1 - 0.3 * dt);
          cop.speed *= 0.95;
        } else {
          arrestHold += dt;
        }
      }
      // Cops shoot when close: a 7-damage bullet every 1.2–2.0 s. Against a
      // fast-moving car they hold fire — they cannot lead the target.
      cop.shootT -= dt;
      const playerSpeed = p.inCar && p.car ? Math.abs(p.car.speed) : 0;
      if (d < 480 && cop.shootT <= 0 && playerSpeed < 300) {
        cop.shootT = POLICE.shootIntervalMin + rand() * POLICE.shootIntervalSpread;
        const a = angleTo(cop.x, cop.y, p.x, p.y) + range(rand, -0.09, 0.09);
        state.ebullets.push({
          x: cop.x, y: cop.y,
          vx: Math.cos(a) * POLICE.bulletSpeed, vy: Math.sin(a) * POLICE.bulletSpeed,
          life: 1.4, dmg: POLICE.bulletDamage,
        });
        if (audio) audio.sfx('enemyShoot');
      }
    }
    if (arrestHold > 0 && state.mode === 'play') {
      state.arrestT += arrestHold;
      if (state.arrestT > POLICE.arrestHoldSec) {
        state.arrestT = 0;
        hurtPlayer(9999, 'arrest');
      }
    } else {
      state.arrestT = 0;
    }
  }

  function stepEnemies(dt, audio) {
    const p = state.player;
    for (const e of state.enemies) {
      const d = dist(e.x, e.y, p.x, p.y);
      if (d < 520) {
        e.angle = angleTo(e.x, e.y, p.x, p.y);
        const want = d > 300 ? 1 : d < 180 ? -1 : 0;
        e.x += Math.cos(e.angle) * want * e.speed * dt;
        e.y += Math.sin(e.angle) * want * e.speed * dt;
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = 1.2 + rand() * 0.8;
          const a = e.angle + range(rand, -0.08, 0.08);
          state.ebullets.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
            life: 1.4, dmg: 7,
          });
          if (audio) audio.sfx('enemyShoot');
        }
      } else {
        e.x += Math.cos(e.angle) * e.speed * 0.4 * dt;
        e.y += Math.sin(e.angle) * e.speed * 0.4 * dt;
      }
      e.x = clamp(e.x, 140, WORLD.width - 40);
      e.y = clamp(e.y, 40, WORLD.height - 40);
      for (const b of state.buildings) pushOutOfRect(e, 13, b);
    }
  }

  function bulletHitsBuilding(b) {
    for (const bd of state.buildings) {
      if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) return true;
    }
    return false;
  }

  function carRectHit(car, x, y) {
    const dx = x - car.x;
    const dy = y - car.y;
    const ca = Math.cos(-car.angle);
    const sa = Math.sin(-car.angle);
    const lx = dx * ca - dy * sa;
    const ly = dx * sa + dy * ca;
    return Math.abs(lx) < 26 && Math.abs(ly) < 14;
  }

  function stepBullets(dt) {
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) continue;
      if (bulletHitsBuilding(b)) { b.life = 0; burst(b.x, b.y, '#c9c9c9', 3, 90); continue; }
      let consumed = false;
      for (const e of state.enemies) {
        if (dist(b.x, b.y, e.x, e.y) < 17) {
          e.hp -= b.dmg;
          state.stats.hits += 1;
          burst(b.x, b.y, '#e5534b', 6, 160);
          b.life = 0;
          consumed = true;
          if (e.hp <= 0) {
            state.enemies = state.enemies.filter((x) => x !== e);
            state.kills += 1;
            burst(e.x, e.y, '#e5534b', 14, 220);
            if (e.kind === 'dario') setMessage('Dario is down — the Bay is yours');
            else if (e.kind === 'goon') {
              state.wanted = Math.min(WANTED.max, state.wanted + 1);
              state.crimeT = 0;
            }
          }
          break;
        }
      }
      if (consumed) continue;
      for (const ped of state.peds) {
        if (dist(b.x, b.y, ped.x, ped.y) < 15) {
          state.peds = state.peds.filter((x) => x !== ped);
          burst(ped.x, ped.y, '#e5534b', 10, 180);
          state.wanted = Math.min(WANTED.max, state.wanted + WANTED.killPed);
          state.crimeT = 0;
          setMessage('Civilian down — the city saw that');
          for (const other of state.peds) if (dist(other.x, other.y, ped.x, ped.y) < 320) other.flee = 4;
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of state.cars) {
        if (car.dead || car === p.car) continue;
        if (carRectHit(car, b.x, b.y)) {
          car.hp -= b.dmg;
          burst(b.x, b.y, '#ffd34d', 5, 140);
          b.life = 0;
          if (car.hp <= 0) {
            car.dead = true;
            car.deadT = 0;
            burst(car.x, car.y, '#e5534b', 18, 260);
            burst(car.x, car.y, '#555', 12, 120);
            if (car.police) {
              state.wanted = Math.min(WANTED.max, state.wanted + WANTED.killCop);
              state.kills += 1;
              setMessage('SBPD unit destroyed — heat is on you');
            } else if (car.rat) {
              state.ratCar = null;
              setMessage('The rat’s car is wrecked — he is going nowhere');
            }
          }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    for (const b of state.ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || bulletHitsBuilding(b)) { b.life = 0; continue; }
      if (p.inCar && p.car) {
        if (carRectHit(p.car, b.x, b.y)) {
          // A car body soaks most of a pistol round.
          hurtPlayer(b.dmg * 0.25, 'shot');
          b.life = 0;
          burst(b.x, b.y, '#ffd34d', 4, 120);
          continue;
        }
      } else if (dist(b.x, b.y, p.x, p.y) < 15) {
        hurtPlayer(b.dmg, 'shot');
        b.life = 0;
        burst(b.x, b.y, '#e5534b', 5, 140);
      }
    }
    state.ebullets = state.ebullets.filter((b) => b.life > 0);
  }

  function stepMission(dt) {
    const stage = currentStage();
    if (!stage || state.dialogue) return;
    const p = state.player;
    if (stage.kind === 'goto') {
      if (dist(p.x, p.y, stage.x, stage.y) < stage.radius) {
        if (state.missionIndex === 0 && state.stageIndex === 0) setMessage('Package secured — get it to Lena');
        advanceStage();
      }
    } else if (stage.kind === 'kill') {
      state.target = { x: stage.x, y: stage.y, label: `${stage.label} (${state.enemies.length} left)` };
      if (state.enemies.length === 0) advanceStage();
    } else if (stage.kind === 'chase') {
      const rat = state.ratCar;
      if (!rat) { advanceStage(); return; }
      state.target = { x: rat.x, y: rat.y, label: stage.label };
      // The rat flees along the road grid, away from Mara.
      const d = dist(p.x, p.y, rat.x, rat.y);
      if (d < stage.radius) {
        rat.speed = 0;
        state.ratCar = null;
        setMessage('Got him — the rat is in the trunk');
        advanceStage();
        return;
      }
      const want = angleTo(rat.x, rat.y, rat.x + (rat.x - p.x), rat.y + (rat.y - p.y));
      const diff = wrapAngle(want - rat.angle);
      rat.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
      rat.speed += clamp(360 - rat.speed, -300 * dt, 240 * dt);
      rat.x += Math.cos(rat.angle) * rat.speed * dt;
      rat.y += Math.sin(rat.angle) * rat.speed * dt;
      rat.x = clamp(rat.x, 130, WORLD.width - 30);
      rat.y = clamp(rat.y, 30, WORLD.height - 30);
      collideCarsWithBuildings(rat);
    } else if (stage.kind === 'spray') {
      state.target = { x: SPRAY.x, y: SPRAY.y, label: stage.label };
      if (p.inCar && dist(p.x, p.y, SPRAY.x, SPRAY.y) < SPRAY.radius && state.sprayCooldown <= 0) {
        const paid = Math.min(SPRAY.cost, state.cash);
        state.cash -= paid;
        state.wanted = 0;
        p.armor = PLAYER.maxArmor / 2;
        state.sprayCooldown = 5;
        setMessage(`Pay-and-spray — clean car, clean record (-$${paid})`);
        advanceStage();
      }
    }
  }

  function stepWanted(dt) {
    state.crimeT += dt;
    const copsNear = state.cars.some((c) => c.police && !c.dead && dist(c.x, c.y, state.player.x, state.player.y) < 500);
    if (copsNear && state.wanted > 0 && state.wanted < WANTED.max) {
      // A chase that drags on draws more heat.
      state.pursuitT += dt;
      if (state.pursuitT > 12) {
        state.pursuitT = 0;
        state.wanted += 1;
        setMessage(`Heat rising — ${state.wanted} stars`);
      }
    } else {
      state.pursuitT = 0;
    }
    if (state.wanted > 0 && state.crimeT > WANTED.decayEverySec && !copsNear) {
      state.wanted -= 1;
      state.crimeT = 0;
      if (state.wanted === 0) setMessage('Heat is off — for now');
    }
  }

  function updateCamera() {
    const vw = state.view.w;
    const vh = state.view.h;
    state.camera.x = clamp(state.player.x - vw / 2, 0, Math.max(0, WORLD.width - vw));
    state.camera.y = clamp(state.player.y - vh / 2, 0, Math.max(0, WORLD.height - vh));
  }

  // The single source for window.__solmar: every debug read goes through here.
  function updateDebug() {
    const p = state.player;
    const stage = currentStage();
    state.debug = {
      mode: state.mode,
      dialogue: !!state.dialogue,
      dialogueLine: state.dialogue ? state.dialogue.lines[state.dialogue.i] : null,
      wanted: state.wanted,
      cash: state.cash,
      hp: Math.round(p.hp),
      armor: Math.round(p.armor),
      mission: currentMission() ? currentMission().name : 'Done',
      missionIndex: state.missionIndex,
      stageIndex: state.stageIndex,
      stageLabel: stage ? stage.label : '—',
      kills: state.kills,
      cars: state.cars.filter((c) => !c.dead).length,
      traffic: state.cars.filter((c) => c.traffic && !c.dead).length,
      peds: state.peds.length,
      police: state.cars.filter((c) => c.police && !c.dead).length,
      enemies: state.enemies.length,
      target: state.target,
      time: Math.round(state.time),
      clock: `${String(Math.floor(state.clockMin / 60) % 24).padStart(2, '0')}:${String(Math.floor(state.clockMin % 60)).padStart(2, '0')}`,
      district: districtAt(p.x, p.y),
      inCar: p.inCar,
      speed: p.inCar && p.car ? Math.round(Math.abs(p.car.speed) * 0.22) : 0,
      rain: state.rain,
    };
    window.__solmar = state.debug;
    // Keep the live __G references in step: stepTraffic/newGame reassign the
    // cars array, so refresh the handles here, in the one debug source.
    window.__G.cars = state.cars;
    window.__G.enemies = state.enemies;
    window.__G.bullets = state.bullets;
  }

  function step(dt, ctl, audio) {
    if (state.mode !== 'play') {
      updateDebug();
      return;
    }
    // Autosave runs BEFORE the dialogue early-return, so a game left sitting
    // on a dialogue line still saves its progress.
    state.saveT += dt;
    if (state.saveT >= 5) {
      state.saveT = 0;
      saveNow();
    }
    state.time += dt;
    state.clockMin += dt;
    if (state.clockMin >= 1440) state.clockMin -= 1440;
    state.weatherT -= dt;
    if (state.weatherT <= 0) {
      state.weatherT = range(rand, 35, 80);
      state.rainTarget = state.rainTarget > 0.5 ? 0 : 1;
    }
    state.rain += clamp(state.rainTarget - state.rain, -dt * 0.4, dt * 0.4);
    state.messageT = Math.max(0, state.messageT - dt);
    if (state.messageT === 0) state.message = null;
    state.sprayCooldown = Math.max(0, state.sprayCooldown - dt);
    state.shake = Math.max(0, state.shake - dt * 22);
    if (state.dialogue) {
      updateCamera();
      updateDebug();
      return;
    }
    stepPlayer(dt, ctl, audio);
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt, audio);
    stepEnemies(dt, audio);
    stepBullets(dt);
    stepMission(dt);
    stepWanted(dt);
    // Pay-and-spray works outside the bank mission too.
    const p = state.player;
    if (p.inCar && state.wanted > 0 && dist(p.x, p.y, SPRAY.x, SPRAY.y) < SPRAY.radius && state.sprayCooldown <= 0 && currentStage()?.kind !== 'spray') {
      const paid = Math.min(SPRAY.cost, state.cash);
      state.cash -= paid;
      state.wanted = 0;
      p.armor = PLAYER.maxArmor / 2;
      state.sprayCooldown = 5;
      setMessage(`Pay-and-spray — clean car, clean record (-$${paid})`);
      if (audio) audio.sfx('cash');
    }
    // Slow health regen when the heat is off and Mara has not been hurt lately.
    if (state.wanted === 0 && state.time - p.lastHurt > 5 && p.hp > 0 && p.hp < PLAYER.maxHp) {
      p.hp = Math.min(PLAYER.maxHp, p.hp + 2 * dt);
    }
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    updateCamera();
    updateDebug();
  }

  function newGame() {
    state.cars = [];
    state.enemies = [];
    state.bullets = [];
    state.ebullets = [];
    state.particles = [];
    state.peds = [];
    state.ratCar = null;
    state.cash = 150;
    state.wanted = 0;
    state.kills = 0;
    state.time = 0;
    state.clockMin = 16 * 60 + 30;
    state.message = null;
    state.dialogue = null;
    const p = state.player;
    p.x = SPAWN.x;
    p.y = SPAWN.y;
    p.angle = 0;
    p.hp = PLAYER.maxHp;
    p.armor = 0;
    p.inCar = false;
    p.car = null;
    p.fireT = 0;
    spawnParkedCars();
    spawnPeds();
    state.mode = 'play';
    startMission(0, false);
    updateCamera();
    updateDebug();
  }

  function respawn() {
    const p = state.player;
    const fine = Math.min(BUSTED_FINE, state.cash);
    state.cash -= fine;
    p.hp = PLAYER.maxHp;
    p.armor = 0;
    p.x = SPAWN.x;
    p.y = SPAWN.y;
    p.inCar = false;
    p.car = null;
    state.wanted = 0;
    state.ebullets = [];
    state.arrestT = 0;
    // The mission enemies stay where they are: dying must never clear a
    // kill stage for free — Mara has to go back and finish the job.
    for (const c of state.cars) if (c.police) { c.dead = true; c.deadT = 99; }
    state.mode = 'play';
    setMessage(`Busted — $${fine} fine. Rook got you out.`);
    saveNow();
    updateDebug();
  }

  // Debug hooks for the verification tools (not part of normal play).
  const debugApi = {
    setMission(index) {
      state.enemies = [];
      state.ratCar = null;
      state.dialogue = null;
      state.wanted = 0;
      startMission(clamp(index, 0, MISSIONS.length - 1), true);
      updateDebug();
    },
    warp(x, y) {
      const p = state.player;
      if (p.inCar && p.car) { p.car.x = x; p.car.y = y; p.car.speed = 0; }
      p.x = x;
      p.y = y;
      updateCamera();
      updateDebug();
    },
    setWanted(n) {
      state.wanted = clamp(n, 0, WANTED.max);
      state.crimeT = 0;
      updateDebug();
    },
  };

  spawnParkedCars();
  spawnPeds();
  startMission(0, true);
  state.dialogue = null;
  updateCamera();
  updateDebug();

  return {
    state,
    step,
    newGame,
    loadSave,
    saveNow,
    respawn,
    advanceDialogue,
    startMission,
    debug: debugApi,
  };
}
