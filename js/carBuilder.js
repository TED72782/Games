// ============================================================
// FORGE MOTORS — Procedural car mesh builder
// Builds a parameterized PBR car from the chosen config.
// Body = extruded side silhouette (with real wheel-arch cutouts),
// greenhouse = tinted glass extrusion, plus detail parts.
// ============================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getParts } from './config.js';

const GRAVITY = 9.82;

function paintMaterial(color, finish) {
  const c = new THREE.Color(color);
  switch (finish) {
    case 'metallic':
      return new THREE.MeshPhysicalMaterial({
        color: c, metalness: 0.85, roughness: 0.32,
        clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.1,
      });
    case 'matte':
      return new THREE.MeshPhysicalMaterial({
        color: c, metalness: 0.25, roughness: 0.72, clearcoat: 0, envMapIntensity: 0.6,
      });
    case 'pearl':
      return new THREE.MeshPhysicalMaterial({
        color: c, metalness: 0.45, roughness: 0.25, clearcoat: 1.0,
        clearcoatRoughness: 0.1, iridescence: 0.7, iridescenceIOR: 1.8,
        sheen: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 1.2,
      });
    case 'chrome':
      return new THREE.MeshPhysicalMaterial({
        color: c.lerp(new THREE.Color(0xffffff), 0.55),
        metalness: 1.0, roughness: 0.07, envMapIntensity: 1.5,
      });
    case 'gloss':
    default:
      return new THREE.MeshPhysicalMaterial({
        color: c, metalness: 0.12, roughness: 0.18,
        clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.0,
      });
  }
}

function sharedMaterials() {
  return {
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x202c38, metalness: 0.0, roughness: 0.06,
      clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.6,
    }),
    black: new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.2, roughness: 0.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1.0, roughness: 0.12 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.95, roughness: 0.25 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.8, roughness: 0.35 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x131313, metalness: 0.0, roughness: 0.96 }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0xf5faff, emissive: 0xcfe8ff, emissiveIntensity: 1.6, roughness: 0.2,
    }),
    taillight: new THREE.MeshStandardMaterial({
      color: 0x66060e, emissive: 0xd80f1e, emissiveIntensity: 1.4, roughness: 0.25,
    }),
    disc: new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.9, roughness: 0.45 }),
  };
}

// Body silhouette → extruded shape. Bottom edge runs rear→front with
// arcs cut out over each wheel so the arches are real openings.
function buildBodyShape(outline, bottomY, archR, wzF, wzR) {
  const s = new THREE.Shape();
  const first = outline[0];
  s.moveTo(first[0], first[1]);
  for (let i = 1; i < outline.length; i++) s.lineTo(outline[i][0], outline[i][1]);
  // outline ends at rear-bottom; traverse bottom edge rear → front
  const archY = bottomY + 0.04;
  s.lineTo(wzR + archR, bottomY); // wzR is negative (rear)
  s.absarc(wzR, archY, archR, Math.PI, 0, true);
  s.lineTo(wzF - archR, bottomY);
  s.absarc(wzF, archY, archR, Math.PI, 0, true);
  s.lineTo(first[0], first[1]);
  return s;
}

function extrudeCentered(shape, width, mat, bevel = 0.045) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.1, width - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.rotateY(-Math.PI / 2); // shape X (length) → world Z, extrusion → -X
  geo.translate(width / 2 - bevel, 0, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function closedShape(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

function buildWheel(parts, mats, side) {
  const { tires, rims } = parts;
  const r = tires.radius;
  const w = tires.width;
  const group = new THREE.Group();

  const tireGeo = new THREE.CylinderGeometry(r, r, w, 28);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, mats.tire);
  tire.castShadow = true;
  group.add(tire);

  // Knobby tread blocks for off-road rubber
  if (tires.offroad >= 0.9) {
    const blockGeo = new THREE.BoxGeometry(w + 0.025, 0.07, 0.09);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const block = new THREE.Mesh(blockGeo, mats.tire);
      block.position.set(0, Math.cos(a) * (r - 0.015), Math.sin(a) * (r - 0.015));
      block.rotation.x = -a;
      group.add(block);
    }
  }

  // Brake disc (rotates with the wheel, as real discs do)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.035, 24)
    .rotateZ(Math.PI / 2), mats.disc);
  group.add(disc);

  const out = side; // +1 right, -1 left: rim face offset direction
  const faceX = out * w * 0.30;
  const rimR = r * 0.62;
  const style = rims.style;

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.3, rimR * 0.3, w * 0.5, 16)
    .rotateZ(Math.PI / 2), mats.rim);
  hub.position.x = faceX * 0.5;
  group.add(hub);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, 0.045, 24)
    .rotateZ(Math.PI / 2), style === 'steel' ? mats.rimDark : mats.rim);
  barrel.position.x = faceX;
  group.add(barrel);

  if (style === 'spoke5' || style === 'mesh') {
    const n = style === 'spoke5' ? 5 : 10;
    const thick = style === 'spoke5' ? 0.07 : 0.032;
    const spokeGeo = new THREE.BoxGeometry(0.05, rimR * 1.9, thick);
    for (let i = 0; i < n; i++) {
      const spoke = new THREE.Mesh(spokeGeo, mats.rim);
      spoke.rotation.x = (i / n) * Math.PI;
      spoke.position.x = faceX;
      group.add(spoke);
    }
    barrel.scale.set(1, 0.55, 0.55); // ring only at center, spokes carry the look
    barrel.position.x = faceX * 1.05;
  } else if (style === 'disc') {
    const discFace = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.98, rimR * 0.98, 0.05, 28)
      .rotateZ(Math.PI / 2), mats.rim);
    discFace.position.x = faceX;
    group.add(discFace);
  } else if (style === 'steel') {
    const boltGeo = new THREE.SphereGeometry(0.028, 8, 8);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bolt = new THREE.Mesh(boltGeo, mats.chrome);
      bolt.position.set(faceX + out * 0.03, Math.cos(a) * rimR * 0.55, Math.sin(a) * rimR * 0.55);
      group.add(bolt);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.92, 0.022, 8, 24)
      .rotateY(Math.PI / 2), mats.chrome);
    ring.position.x = faceX + out * 0.025;
    group.add(ring);
  }

  return group;
}

function box(w, h, d, mat, x, y, z, radius = 0.02) {
  const geo = radius > 0
    ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, Math.min(w, h, d) * 0.45))
    : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function buildCar(config) {
  const parts = getParts(config);
  const b = parts.body;
  const mats = sharedMaterials();
  const paint = paintMaterial(config.paint, config.finish);

  const wheelR = parts.tires.radius;
  const archR = Math.min(wheelR + 0.10, b.maxArch);
  const wzF = b.wheelbase / 2;
  const wzR = -b.wheelbase / 2;
  const track = b.width - parts.tires.width - 0.05;

  const bodyGroup = new THREE.Group();

  // --- main body shell ---
  const bodyShape = buildBodyShape(b.outline, b.bottomY, archR, wzF, wzR);
  bodyGroup.add(extrudeCentered(bodyShape, b.width, paint));

  // --- greenhouse (glass) + painted roof cap ---
  const gh = b.greenhouse;
  bodyGroup.add(extrudeCentered(closedShape(gh), b.width * 0.93, mats.glass, 0.03));
  const roofZ0 = gh[1][0]; const roofZ1 = gh[2][0];
  const roofY = (gh[1][1] + gh[2][1]) / 2;
  bodyGroup.add(box(b.width * 0.86, 0.04, Math.abs(roofZ0 - roofZ1) * 0.92, paint,
    0, roofY + 0.012, (roofZ0 + roofZ1) / 2, 0.015));

  const zF = b.length / 2;
  const zR = -b.length / 2;

  // --- bumpers ---
  bodyGroup.add(box(b.width * 0.96, 0.22, 0.3, mats.black, 0, b.bottomY + 0.14, zF - 0.06, 0.06));
  bodyGroup.add(box(b.width * 0.96, 0.22, 0.3, mats.black, 0, b.bottomY + 0.14, zR + 0.06, 0.06));

  // --- grille + lights ---
  bodyGroup.add(box(b.width * 0.42, 0.14, 0.06, mats.black, 0, b.lightY - 0.13, zF + 0.035, 0.02));
  const lx = b.width / 2 - 0.30;
  bodyGroup.add(box(0.34, 0.09, 0.08, mats.headlight, -lx, b.lightY, zF + 0.02, 0.02));
  bodyGroup.add(box(0.34, 0.09, 0.08, mats.headlight, lx, b.lightY, zF + 0.02, 0.02));
  const tailY = b.outline[b.outline.length - 4] ? b.outline[b.outline.length - 4][1] : b.beltY;
  bodyGroup.add(box(0.40, 0.09, 0.07, mats.taillight, -lx, tailY - 0.06, zR - 0.015, 0.02));
  bodyGroup.add(box(0.40, 0.09, 0.07, mats.taillight, lx, tailY - 0.06, zR - 0.015, 0.02));

  // --- mirrors ---
  for (const side of [-1, 1]) {
    const mirror = box(0.16, 0.09, 0.20, paint, side * (b.width / 2 + 0.07), b.mirrorY, b.mirrorZ, 0.03);
    bodyGroup.add(mirror);
  }

  // --- exhaust (not for EV) ---
  if (config.engine !== 'ev') {
    const pipeGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.16, 12).rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      const pipe = new THREE.Mesh(pipeGeo, mats.chrome);
      pipe.position.set(side * 0.32, b.bottomY + 0.10, zR - 0.04);
      bodyGroup.add(pipe);
    }
  }

  // --- spoiler ---
  if (config.spoiler === 'lip') {
    bodyGroup.add(box(b.width * 0.78, 0.05, 0.24, paint, 0, b.deckY + 0.05, b.deckZ, 0.02));
  } else if (config.spoiler === 'gt') {
    const wingY = b.deckY + 0.34;
    bodyGroup.add(box(b.width * 0.88, 0.035, 0.34, mats.black, 0, wingY, b.deckZ, 0.012));
    for (const side of [-1, 1]) {
      bodyGroup.add(box(0.045, 0.34, 0.16, mats.black, side * b.width * 0.32, b.deckY + 0.17, b.deckZ, 0.01));
    }
  }

  // --- style extras ---
  if (config.body === 'pickup' && b.bed) {
    const bedLen = b.bed.z1 - b.bed.z0;
    bodyGroup.add(box(b.width * 0.82, 0.05, bedLen, mats.black,
      0, b.bed.topY - 0.16, (b.bed.z0 + b.bed.z1) / 2, 0));
    bodyGroup.add(box(b.width * 0.82, 0.16, 0.05, mats.black, 0, b.bed.topY - 0.08, b.bed.z1, 0));
  }
  if (config.body === 'suv') {
    for (const side of [-1, 1]) {
      bodyGroup.add(box(0.05, 0.05, 1.9, mats.black, side * b.width * 0.36, b.cabin.topY + 0.05, -0.6, 0.02));
    }
  }
  if (config.body === 'supercar') {
    // rear diffuser fins
    for (let i = -2; i <= 2; i++) {
      bodyGroup.add(box(0.03, 0.12, 0.30, mats.black, i * 0.28, b.bottomY + 0.05, zR + 0.18, 0));
    }
  }

  // --- wheels ---
  const wheels = [];
  const wheelPositions = [
    new THREE.Vector3(-track / 2, 0, wzF), // FL
    new THREE.Vector3(track / 2, 0, wzF),  // FR
    new THREE.Vector3(-track / 2, 0, wzR), // RL
    new THREE.Vector3(track / 2, 0, wzR),  // RR
  ];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    wheels.push(buildWheel(parts, mats, side));
  }

  // --- physics spec ---
  const susp = parts.suspension;
  const deflection = GRAVITY / (4 * susp.stiffness);
  const suspLenRest = susp.restLength - deflection;
  const connY = b.bottomY + 0.04 + suspLenRest; // wheel center rests at arch center
  const stats = getParts(config);
  const engineMass = stats.engine.mass;

  const spec = {
    mass: b.mass + engineMass,
    width: b.width,
    length: b.length,
    wheelbase: b.wheelbase,
    track,
    wheelRadius: wheelR,
    tireWidth: parts.tires.width,
    bottomY: b.bottomY,
    beltY: b.beltY,
    connY,
    suspension: susp,
    frictionSlip: parts.tires.grip,
    engineHp: parts.engine.hp,
    maxEngineForce: parts.engine.hp * 17,
    topSpeedKmh: Math.round(parts.engine.topSpeed * b.aero),
    drivetrain: parts.engine.awd ? 'AWD' : b.drivetrain,
    instantTorque: config.engine === 'ev',
    downforce: parts.spoiler.downforce,
    soundProfile: parts.engine.sound,
    rollInfluence: config.body === 'suv' || config.body === 'pickup' ? 0.12 : 0.04,
    cabin: b.cabin,
    archCenterY: b.bottomY + 0.04,
  };

  // assembled group for the showroom (origin at ground level)
  const group = new THREE.Group();
  const originY = wheelR - spec.archCenterY - susp.clearance * -1;
  bodyGroup.position.y = wheelR - spec.archCenterY + susp.clearance;
  group.add(bodyGroup);
  wheels.forEach((w, i) => {
    w.position.copy(wheelPositions[i]);
    w.position.y = wheelR;
    group.add(w);
  });

  spec.wheelPositions = wheelPositions;
  spec.showroomBodyY = bodyGroup.position.y;
  void originY;

  return { group, bodyGroup, wheels, spec };
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const m = Array.isArray(obj.material) ? obj.material : [obj.material];
      m.forEach((mat) => mat.dispose());
    }
  });
}
