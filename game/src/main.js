// Harbor Lights — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted, dead, done.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART,
  createInput,
} from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
window.__solmarDebug = world.debug;

function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

function runShot(name) {
  const known = ['start', 'play', 'chase', 'end'];
  const scene = known.includes(name) ? name : 'start';
  if (scene !== name) console.warn(`Harbor Lights: unknown shot "${name}", staging start instead.`);
  stageShot(scene, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.state.time, hasSave());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let saved = hasSave();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.resume();
    audio.startMusic();
    if (saved && world.loadSave()) {
      world.state.mode = 'play';
      announce('Continuing your saved game in Solmar Bay.');
    } else {
      world.newGame();
      announce('Playing. Mara Voss, getaway driver. First job: the Old Docks.');
    }
    saved = hasSave();
  }

  function handleActions(actions) {
    const state = world.state;
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART) {
      if (state.mode !== 'title') {
        world.newGame();
        announce('New game started.');
      }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.resume();
      if (state.mode === 'title') startGame();
      else if (state.dialogue) world.advanceDialogue();
      else if (state.mode === 'dead' || state.mode === 'busted') {
        world.respawn();
        announce('Back on the streets of Solmar Bay.');
      } else if (state.mode === 'done') {
        world.newGame();
        announce('New game started.');
      } else if (state.mode === 'paused') {
        state.mode = 'play';
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (state.mode === 'play') {
        state.mode = 'paused';
        announce('Paused.');
      } else if (state.mode === 'paused') {
        state.mode = 'play';
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Take the one-shot presses exactly once per frame: the loop below must
    // not see them again, or a single E would steal a car and exit it.
    const actions = input.takeActions();
    handleActions(actions);
    const state = world.state;
    if (state.mode === 'play') {
      const mouse = input.mouse();
      const ctl = {
        up: input.up(),
        down: input.down(),
        left: input.left(),
        right: input.right(),
        move: input.move(),
        aim: { x: mouse.x, y: mouse.y },
        firing: mouse.down || input.takeClick(),
        interact: !!(actions & ACTION_INTERACT),
      };
      while (accumulator >= STEP) {
        // Re-read the held keys each step so a release mid-frame still lands.
        ctl.up = input.up();
        ctl.down = input.down();
        ctl.left = input.left();
        ctl.right = input.right();
        ctl.move = input.move();
        world.step(STEP, ctl, audio);
        accumulator -= STEP;
        ctl.interact = false;
        if (world.state.mode !== 'play') break;
      }
      audio.updateMusic();
    } else {
      accumulator = 0;
      // Every non-play screen still steps once a frame: step() is the one
      // place updateDebug() runs, so without this window.__solmar would
      // keep reporting 'play' while the game is paused, busted or done.
      world.step(STEP, null, null);
    }
    renderer.draw(state, state.time, saved);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state.mode === 'play') {
      world.state.mode = 'paused';
      announce('Paused.');
    }
  });

  announce('Harbor Lights. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
