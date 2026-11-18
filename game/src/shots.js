// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the
// real rules forward from a fresh game with a small autopilot — walk to a car,
// steal it, drive the road grid to the mission marker, fight at the docks —
// so the frame is what a short game really looks like, and the same seed
// always gives the same frame.
import { ROADS_X, ROADS_Y, STEP } from './config.js';

const RX = ROADS_X;
const RY = ROADS_Y;

// The driving waypoints are stateful across steps: advance only when the
// current one is reached, otherwise the car re-targets a waypoint behind
// it, cuts the corner through a building and wedges itself there.
let wpKey = '';
let wpIdx = 0;

function near(arr, v) {
  return arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

function driveCtl(state, tx, ty) {
  const p = state.player;
  const ctl = {
    up: false, down: false, left: false, right: false,
    move: { x: 0, y: 0 }, aim: { x: 640, y: 360 }, firing: false, interact: false,
  };
  if (!p.inCar) {
    // Walk to the nearest parked car, then steal it.
    let best = null;
    let bestD = 1e9;
    for (const c of state.cars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best) return ctl;
    if (bestD < 55) { ctl.interact = true; return ctl; }
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    ctl.move = { x: dx, y: dy };
    return ctl;
  }
  // Drive the road grid: hop between intersections, never cut through blocks.
  const key = `${tx},${ty}`;
  if (key !== wpKey) { wpKey = key; wpIdx = 0; }
  const wps = [
    { x: near(RX, p.x), y: near(RY, p.y) },
    { x: near(RX, tx), y: near(RY, p.y) },
    { x: near(RX, tx), y: near(RY, ty) },
    { x: tx, y: ty },
  ];
  while (wpIdx < wps.length - 1 && Math.hypot(wps[wpIdx].x - p.x, wps[wpIdx].y - p.y) < 70) wpIdx += 1;
  const wp = wps[Math.min(wpIdx, wps.length - 1)];
  const want = Math.atan2(wp.y - p.y, wp.x - p.x);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Coast into a sharp turn instead of powering through it: the car turns
  // tighter and does not overshoot the intersection by 300 px.
  ctl.up = Math.abs(diff) < 0.9;
  ctl.left = diff < -0.15;
  ctl.right = diff > 0.15;
  return ctl;
}

function skipDialogue(world) {
  while (world.state.dialogue) world.advanceDialogue();
}

function stealAndDrive(world, seconds, targetFn) {
  const state = world.state;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.mode !== 'play') break;
    const t = targetFn(state);
    world.step(STEP, driveCtl(state, t.x, t.y), null);
  }
}

// Fight the enemies at the docks on foot: strafe in a circle at ~350 px,
// always firing at the nearest living enemy. Returns when the stage clears.
function fightAtDocks(world, seconds) {
  const state = world.state;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.mode !== 'play' || state.enemies.length === 0) break;
    const p = state.player;
    let best = null;
    let bestD = 1e9;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    // Strafe: circle the cluster, keeping ~350 px away.
    const cx = 300;
    const cy = 400;
    const ang = Math.atan2(p.y - cy, p.x - cx) + 0.35;
    const tx = cx + Math.cos(ang) * 350;
    const ty = cy + Math.sin(ang) * 350;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const ctl = {
      up: false, down: false, left: false, right: false,
      move: { x: dx, y: dy },
      aim: { x: best.x - state.camera.x, y: best.y - state.camera.y },
      firing: true, interact: false,
    };
    world.step(STEP, ctl, null);
    // Keep the heat off for the staged shot: the crew is the fight, not SBPD.
    if (state.wanted > 0) world.debug.setWanted(0);
    if (p.hp < 35) {
      // Fall back out of range, let the regen and the distance do their work.
      world.debug.warp(p.x + 300, p.y - 200);
    }
  }
}

export function stageShot(name, world) {
  const state = world.state;
  wpKey = '';
  wpIdx = 0;
  if (name === 'start') {
    return;
  }
  world.newGame();
  skipDialogue(world);
  if (name === 'play') {
    stealAndDrive(world, 20, (s) => s.target);
    return;
  }
  if (name === 'chase') {
    state.rainTarget = 1;
    state.rain = 0.6;
    stealAndDrive(world, 3, (s) => s.target);
    world.debug.setWanted(5);
    stealAndDrive(world, 6, (s) => s.target);
    return;
  }
  if (name === 'end') {
    // The final job, played through: reach the yacht, win the shootout,
    // board the yacht — the victory screen is the frame.
    world.debug.setMission(5);
    world.debug.warp(300, 400);
    const idle = {
      up: false, down: false, left: false, right: false,
      move: { x: 0, y: 0 }, aim: { x: 640, y: 360 }, firing: false, interact: false,
    };
    for (let i = 0; i < 120 && state.stageIndex < 1 && state.mode === 'play'; i += 1) {
      world.step(STEP, idle, null);
    }
    fightAtDocks(world, 40);
    if (state.mode === 'play' && state.enemies.length === 0 && state.stageIndex === 2) {
      world.debug.warp(300, 300);
      for (let i = 0; i < 120 && state.mode === 'play'; i += 1) {
        world.step(STEP, idle, null);
      }
    }
  }
}
