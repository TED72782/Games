// ============================================================
// FORGE MOTORS — Parts catalog & vehicle stat math
// All dimensions in meters, masses in kg, forward axis = +Z
// ============================================================

export const BODIES = {
  sports: {
    name: 'Vantage GT', tag: 'Sports Coupe',
    desc: 'Low-slung rear-drive coupe. Sharp, light, eager.',
    mass: 1310, width: 1.88, length: 4.4, wheelbase: 2.70,
    bottomY: -0.40, beltY: 0.16, drivetrain: 'RWD', aero: 1.00,
    maxArch: 0.46, price: 52000, handling: 0.85, offroad: 0.25,
    outline: [
      [2.20, -0.40], [2.27, -0.16], [2.20, -0.02], [1.95, 0.04],
      [0.75, 0.12], [-1.30, 0.16], [-2.10, 0.18], [-2.24, 0.02],
      [-2.18, -0.20], [-2.14, -0.40],
    ],
    greenhouse: [[0.70, 0.10], [0.15, 0.44], [-0.85, 0.46], [-1.45, 0.14]],
    cabin: { z0: -1.45, z1: 0.70, topY: 0.46 },
    lightY: -0.04, deckZ: -1.95, deckY: 0.19, mirrorZ: 0.68, mirrorY: 0.24,
  },
  supercar: {
    name: 'Tempest X', tag: 'Supercar',
    desc: 'Mid-engine wedge. Cab-forward, ground-hugging, brutal.',
    mass: 1260, width: 1.98, length: 4.5, wheelbase: 2.75,
    bottomY: -0.34, beltY: 0.13, drivetrain: 'RWD', aero: 1.05,
    maxArch: 0.44, price: 145000, handling: 0.95, offroad: 0.12,
    outline: [
      [2.25, -0.34], [2.32, -0.14], [2.25, -0.04], [1.60, 0.02],
      [0.70, 0.08], [0.00, 0.12], [-1.20, 0.14], [-2.10, 0.24],
      [-2.26, 0.06], [-2.20, -0.16], [-2.16, -0.34],
    ],
    greenhouse: [[0.65, 0.06], [0.05, 0.40], [-0.75, 0.42], [-1.30, 0.12]],
    cabin: { z0: -1.30, z1: 0.65, topY: 0.42 },
    lightY: -0.06, deckZ: -1.90, deckY: 0.22, mirrorZ: 0.62, mirrorY: 0.20,
  },
  sedan: {
    name: 'Aurora S', tag: 'Executive Sedan',
    desc: 'Balanced four-door saloon. Comfort with composure.',
    mass: 1480, width: 1.84, length: 4.6, wheelbase: 2.80,
    bottomY: -0.45, beltY: 0.18, drivetrain: 'FWD', aero: 0.96,
    maxArch: 0.47, price: 34000, handling: 0.62, offroad: 0.35,
    outline: [
      [2.30, -0.45], [2.34, -0.18], [2.30, 0.00], [2.10, 0.10],
      [0.85, 0.18], [-1.40, 0.22], [-2.20, 0.20], [-2.32, 0.02],
      [-2.26, -0.20], [-2.22, -0.45],
    ],
    greenhouse: [[0.80, 0.16], [0.34, 0.55], [-0.70, 0.58], [-1.35, 0.20]],
    cabin: { z0: -1.35, z1: 0.80, topY: 0.58 },
    lightY: 0.02, deckZ: -2.00, deckY: 0.23, mirrorZ: 0.78, mirrorY: 0.30,
  },
  hatch: {
    name: 'Pulse RS', tag: 'Hot Hatch',
    desc: 'Compact, flickable, surprisingly quick everywhere.',
    mass: 1220, width: 1.80, length: 4.1, wheelbase: 2.55,
    bottomY: -0.42, beltY: 0.18, drivetrain: 'FWD', aero: 0.95,
    maxArch: 0.47, price: 28000, handling: 0.72, offroad: 0.40,
    outline: [
      [2.05, -0.42], [2.10, -0.16], [2.05, 0.02], [1.85, 0.10],
      [0.75, 0.16], [-1.60, 0.20], [-1.95, 0.18], [-2.06, 0.00],
      [-2.00, -0.20], [-1.96, -0.42],
    ],
    greenhouse: [[0.70, 0.14], [0.25, 0.52], [-1.30, 0.56], [-1.85, 0.16]],
    cabin: { z0: -1.85, z1: 0.70, topY: 0.56 },
    lightY: 0.02, deckZ: -1.70, deckY: 0.52, mirrorZ: 0.68, mirrorY: 0.28,
  },
  suv: {
    name: 'Sierra V', tag: 'SUV',
    desc: 'Tall all-wheel-drive hauler. Happy on dirt and asphalt.',
    mass: 2080, width: 1.95, length: 4.8, wheelbase: 2.90,
    bottomY: -0.55, beltY: 0.30, drivetrain: 'AWD', aero: 0.88,
    maxArch: 0.56, price: 46000, handling: 0.45, offroad: 0.80,
    outline: [
      [2.40, -0.55], [2.46, -0.25], [2.40, 0.10], [2.15, 0.22],
      [0.90, 0.30], [-2.00, 0.34], [-2.42, 0.30], [-2.46, 0.00],
      [-2.40, -0.30], [-2.36, -0.55],
    ],
    greenhouse: [[0.85, 0.30], [0.45, 0.80], [-1.70, 0.84], [-2.05, 0.32]],
    cabin: { z0: -2.05, z1: 0.85, topY: 0.84 },
    lightY: 0.08, deckZ: -2.10, deckY: 0.80, mirrorZ: 0.80, mirrorY: 0.44,
  },
  pickup: {
    name: 'Ranger Bravo', tag: 'Pickup',
    desc: 'Body-on-frame workhorse with a wide-open bed.',
    mass: 2280, width: 1.96, length: 5.3, wheelbase: 3.30,
    bottomY: -0.55, beltY: 0.30, drivetrain: 'AWD', aero: 0.85,
    maxArch: 0.56, price: 42000, handling: 0.38, offroad: 0.88,
    outline: [
      [2.65, -0.55], [2.71, -0.22], [2.65, 0.12], [2.32, 0.24],
      [1.05, 0.30], [-0.20, 0.30], [-0.28, 0.26], [-2.58, 0.26],
      [-2.66, 0.00], [-2.60, -0.28], [-2.55, -0.55],
    ],
    greenhouse: [[0.95, 0.28], [0.55, 0.78], [-0.15, 0.80], [-0.26, 0.28]],
    cabin: { z0: -0.26, z1: 0.95, topY: 0.80 },
    lightY: 0.10, deckZ: -2.40, deckY: 0.26, mirrorZ: 0.90, mirrorY: 0.44,
    bed: { z0: -2.50, z1: -0.34, topY: 0.26 },
  },
};

export const ENGINES = {
  i4t: {
    name: '2.0L Turbo I4', desc: '250 hp · efficient and punchy',
    hp: 250, topSpeed: 218, mass: 135, sound: 'i4', price: 6500,
  },
  v6tt: {
    name: '3.0L Twin-Turbo V6', desc: '450 hp · broad torque band',
    hp: 450, topSpeed: 252, mass: 185, sound: 'v6', price: 14500,
  },
  v8s: {
    name: '6.2L Supercharged V8', desc: '640 hp · thunder on demand',
    hp: 640, topSpeed: 290, mass: 250, sound: 'v8', price: 24000,
  },
  v12: {
    name: '6.5L V12', desc: '780 hp · 9,000 rpm symphony',
    hp: 780, topSpeed: 335, mass: 290, sound: 'v12', price: 38000,
  },
  ev: {
    name: 'Dual-Motor Electric', desc: '700 hp · instant torque · AWD',
    hp: 700, topSpeed: 262, mass: 430, sound: 'ev', price: 22000, awd: true,
  },
};

export const TIRES = {
  street: {
    name: 'All-Season Street', desc: 'Quiet, predictable grip',
    grip: 1.9, radius: 0.34, width: 0.24, offroad: 0.45, price: 800,
  },
  sport: {
    name: 'Sport Performance', desc: 'Sticky summer compound',
    grip: 2.6, radius: 0.35, width: 0.27, offroad: 0.30, price: 1600,
  },
  slick: {
    name: 'Racing Slicks', desc: 'Maximum dry grip, track only',
    grip: 3.4, radius: 0.34, width: 0.30, offroad: 0.15, price: 3200,
  },
  offroad: {
    name: 'All-Terrain Off-Road', desc: 'Knobby, tall, unstoppable',
    grip: 2.0, radius: 0.42, width: 0.30, offroad: 1.00, price: 1900,
  },
  drift: {
    name: 'Drift Spec', desc: 'Hard compound — built to slide',
    grip: 1.35, radius: 0.34, width: 0.26, offroad: 0.30, price: 1200,
  },
};

export const RIMS = {
  sport5: { name: 'Razor 5-Spoke', desc: 'Forged alloy', style: 'spoke5', price: 2200 },
  blade: { name: 'Aero Disc', desc: 'Turbofan style', style: 'disc', price: 2800 },
  retro: { name: 'Classic Mesh', desc: '10-spoke wire look', style: 'mesh', price: 1800 },
  beadlock: { name: 'Beadlock Steel', desc: 'Trail-rated', style: 'steel', price: 1400 },
};

export const SUSPENSIONS = {
  lowered: {
    name: 'Lowered Coilovers', desc: 'Slammed, razor responses',
    restLength: 0.32, stiffness: 52, handling: 1.15, clearance: -0.06, price: 3400,
  },
  sport: {
    name: 'Sport Tuned', desc: 'Firm with compliance',
    restLength: 0.36, stiffness: 42, handling: 1.08, clearance: -0.02, price: 2200,
  },
  standard: {
    name: 'Comfort Standard', desc: 'Factory ride quality',
    restLength: 0.40, stiffness: 34, handling: 1.0, clearance: 0, price: 0,
  },
  rally: {
    name: 'Rally Long-Travel', desc: 'Lifted, soaks up anything',
    restLength: 0.52, stiffness: 26, handling: 0.88, clearance: 0.10, price: 4100,
  },
};

export const SPOILERS = {
  none: { name: 'None', desc: 'Clean deck', downforce: 0, price: 0 },
  lip: { name: 'Lip Spoiler', desc: 'Subtle high-speed stability', downforce: 0.25, price: 900 },
  gt: { name: 'GT Wing', desc: 'Serious rear downforce', downforce: 0.6, price: 2600 },
};

export const FINISHES = {
  gloss: { name: 'Gloss', desc: 'Deep clearcoat shine', price: 0 },
  metallic: { name: 'Metallic', desc: 'Fine metal flake', price: 1200 },
  matte: { name: 'Matte', desc: 'Stealth satin', price: 2400 },
  pearl: { name: 'Pearlescent', desc: 'Color-shift iridescence', price: 3800 },
  chrome: { name: 'Chrome', desc: 'Full mirror wrap', price: 6500 },
};

export const SWATCHES = [
  '#c8102e', '#ff5f00', '#ffc600', '#1db954', '#00566e', '#0f6bff',
  '#5d3fd3', '#e0e3e8', '#8c9099', '#23272d', '#3a2618', '#f4f6f8',
];

export const defaultConfig = {
  body: 'sports',
  engine: 'v8s',
  tires: 'sport',
  rims: 'sport5',
  suspension: 'sport',
  spoiler: 'lip',
  finish: 'metallic',
  paint: '#c8102e',
};

export function getParts(cfg) {
  return {
    body: BODIES[cfg.body],
    engine: ENGINES[cfg.engine],
    tires: TIRES[cfg.tires],
    rims: RIMS[cfg.rims],
    suspension: SUSPENSIONS[cfg.suspension],
    spoiler: SPOILERS[cfg.spoiler],
    finish: FINISHES[cfg.finish],
  };
}

export function computeStats(cfg) {
  const p = getParts(cfg);
  const weight = Math.round(p.body.mass + p.engine.mass + (cfg.tires === 'offroad' ? 60 : 0));
  const hp = p.engine.hp;

  let top = p.engine.topSpeed * p.body.aero;
  if (cfg.tires === 'slick') top *= 1.02;
  if (cfg.tires === 'offroad') top *= 0.92;
  if (cfg.spoiler === 'gt') top *= 0.97;
  top = Math.round(top);

  const launch = Math.pow(1.9 / p.tires.grip, 0.4);
  const accel = Math.max(2.1, (weight / hp) * 1.55 * launch);

  const grip = p.tires.grip * (0.55 + p.body.handling * 0.6) * p.suspension.handling
    * (1 + p.spoiler.downforce * 0.18);

  const offroad = Math.min(1,
    p.tires.offroad * 0.55 + p.body.offroad * 0.3 + (p.suspension.clearance + 0.06) * 1.8);

  const price = p.body.price + p.engine.price + p.tires.price * 4 + p.rims.price
    + p.suspension.price + p.spoiler.price + p.finish.price;

  const drivetrain = p.engine.awd ? 'AWD' : p.body.drivetrain;

  return { hp, weight, top, accel, grip, offroad, price, drivetrain };
}
