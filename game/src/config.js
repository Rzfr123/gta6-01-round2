// Harbor Lights — every tuning number, the city layout and the story chain.
// Solmar Bay is a fictional coastal city, 3400x2600, with six districts.
// Nothing here comes from any other game: all names, places and numbers are original.
export const STEP = 1 / 60;
export const WORLD = { width: 3400, height: 2600 };
export const SAVE_KEY = 'solmarbay.save.v1';

// Road centrelines. The autopilot in the verification tools routes on this grid.
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_W = 90;

// Central Park: no buildings here, only trees and the deal point.
export const PARK = { x: 1450, y: 1050, w: 700, h: 300 };
// The harbour runs down the west edge; the docks sit on it.
export const HARBOR = { x: 0, y: 0, w: 120, h: 2600 };

export const SPAWN = { x: 600, y: 600 };
export const SPRAY = { x: 2600, y: 1400, radius: 100, cost: 200 };
export const BUSTED_FINE = 100;

export const PLAYER = {
  walkSpeed: 175,
  radius: 14,
  maxHp: 100,
  maxArmor: 100,
  bulletDamage: 34,
  bulletSpeed: 720,
  fireInterval: 0.22,
};

export const CAR = {
  accel: 320,
  brake: 480,
  maxForward: 430,
  maxReverse: 150,
  drag: 0.55,
  // Steering authority never drops below 0.4 while the throttle or brake
  // is held, so a slow car can still turn out of a dead end.
  steerRate: 2.3,
  minSteer: 0.4,
  length: 46,
  width: 22,
};

export const TRAFFIC = {
  maxTotalCars: 24,
  spawnEvery: 2,
  speedMin: 110,
  speedMax: 185,
  parkedCount: 12,
};

export const PEDS = { count: 16, walkSpeed: 55 };

// Police tuning (baked-in fixes): ramming is one 6-hp hit per cop with a
// 2 s back-off afterwards, never a grind (the old 140 hp/s shredder is
// gone); cop bullets deal 7, and a cop only opens fire every 1.2–2.0 s.
export const POLICE = {
  ramHit: 6,
  ramCooldownSec: 2,
  bulletDamage: 7,
  shootIntervalMin: 1.2,
  shootIntervalSpread: 0.8,
  bulletSpeed: 560,
  chaseSpeed: 400,
  arrestRange: 42,
  arrestHoldSec: 1.2,
};

export const WANTED = {
  max: 5,
  stealCar: 1,
  shoot: 1,
  killPed: 1,
  killCop: 2,
  decayEverySec: 25,
};

// Cash rewards for the six story missions, in order.
export const MISSION_REWARDS = [300, 500, 700, 800, 2000, 3000];

export const MISSIONS = [
  {
    name: 'First Job',
    reward: 300,
    intro: [
      'ROOK: Mara. One job, no questions. There is a package waiting at the Old Docks corner.',
      'MARA: And if the package bites?',
      'ROOK: Then drive fast. Deliver it to Lena on Sunset Strip and the $300 is yours.',
    ],
    stages: [
      { kind: 'goto', x: 1400, y: 600, radius: 90, label: 'Pick up the package at the Old Docks corner' },
      { kind: 'goto', x: 1400, y: 1400, radius: 90, label: 'Deliver the package to Lena' },
    ],
  },
  {
    name: 'Getaway Driver',
    reward: 500,
    intro: [
      'ROOK: The crew hit a pawn shop in Marina Bay. SBPD is already rolling.',
      'MARA: So I drive, they hide, and I get paid?',
      'ROOK: Pick them up, lose the heat, reach the safehouse. $500.',
    ],
    stages: [
      { kind: 'goto', x: 2200, y: 600, radius: 90, label: 'Pick up the crew in Marina Bay' },
      { kind: 'goto', x: 2600, y: 1800, radius: 100, label: 'Reach the safehouse — lose the cops', wanted: 2 },
    ],
  },
  {
    name: 'The Park Deal',
    reward: 700,
    intro: [
      'LENA: The buyer meets us in Central Park. Cash for the goods, clean and quiet.',
      'MARA: Quiet never lasts in this city.',
      'LENA: Then bring your pistol. Harlow has been sniffing around my deals.',
    ],
    stages: [
      { kind: 'goto', x: 1800, y: 1200, radius: 90, label: 'Meet Lena in Central Park' },
      { kind: 'kill', x: 1800, y: 1200, count: 4, radius: 500, label: 'Harlow’s crew crashed the deal — take them down' },
      { kind: 'goto', x: 1800, y: 1200, radius: 60, label: 'Grab the cash from the deal' },
    ],
  },
  {
    name: 'Chase the Rat',
    reward: 800,
    intro: [
      'ROOK: One of ours talked to Harlow. The rat is running in a grey sedan, last seen Downtown.',
      'MARA: I will bring him back in the trunk.',
      'ROOK: Just get close enough to cut him off. $800.',
    ],
    stages: [
      { kind: 'chase', x: 1000, y: 1000, radius: 80, label: 'Chase the rat — get close and cut him off' },
    ],
  },
  {
    name: 'Bank of Solmar',
    reward: 2000,
    intro: [
      'ROOK: The Bank of Solmar. In and out in four minutes, then the whole city is after us.',
      'MARA: Four minutes is plenty.',
      'ROOK: Grab the cash, then get to the pay-and-spray garage. $2,000 if we walk away clean.',
    ],
    stages: [
      { kind: 'goto', x: 1000, y: 1000, radius: 90, label: 'Reach the Bank of Solmar' },
      { kind: 'spray', x: 2600, y: 1400, radius: 100, label: 'Escape to the pay-and-spray garage', wanted: 4 },
    ],
  },
  {
    name: 'King of the Bay',
    reward: 3000,
    intro: [
      'LENA: Dario is on his yacht at the Old Docks, counting our money.',
      'MARA: Then tonight the Bay gets a new king.',
      'ROOK: End it, Mara. All of it. $3,000 — and Solmar Bay is yours.',
    ],
    stages: [
      { kind: 'goto', x: 300, y: 400, radius: 100, label: 'Reach Harlow’s yacht at the Old Docks' },
      { kind: 'kill', x: 300, y: 400, count: 6, radius: 520, label: 'Take down Dario and his crew', boss: true },
      { kind: 'goto', x: 300, y: 300, radius: 80, label: 'Board the yacht — Solmar Bay is yours' },
    ],
  },
];

export const PALETTE = {
  water: '#16324a',
  grass: '#2c4a2e',
  parkGrass: '#35683a',
  road: '#33373f',
  roadLine: '#c9a227',
  sidewalk: '#4a4a44',
  building: '#5a5f6e',
  buildingRoof: '#7a7f8e',
  downtown: '#4d5468',
  player: '#ffcf3f',
  playerCar: '#e5534b',
  trafficCar: '#7fb3d5',
  policeCar: '#2f6fd0',
  ped: '#d8c9a3',
  goon: '#b03a2e',
  dario: '#7b2d8b',
  hudBg: 'rgba(10,12,18,0.72)',
  text: '#eef1f5',
  muted: '#9aa3b2',
  accent: '#ffd34d',
  star: '#ffd34d',
  hp: '#58d68d',
  armor: '#5dade2',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
