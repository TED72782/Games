// ============================================================
// FORGE MOTORS — Proving Ground (test drive)
// Raycast-vehicle physics via cannon-es, full obstacle course:
// slalom, speed bumps, jump ramp, crate wall, seesaw, water-gap
// bridge, barrel field, plus a free-roam off-road heightfield.
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Sky } from 'three/addons/objects/Sky.js';
import { buildCar, disposeObject } from './carBuilder.js';

const ROAD_W = 14;
const START_Z = -25;
const FINISH_Z = 330;

function makeCanvasTexture(size, painter, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  painter(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noisePaint(base, speckles) {
  return (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (const [color, count, rMin, rMax] of speckles) {
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const r = rMin + Math.random() * (rMax - rMin);
        ctx.globalAlpha = 0.25 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };
}

export class Drive {
  constructor(renderer, config, { onExit }, audio) {
    this.renderer = renderer;
    this.config = config;
    this.onExit = onExit;
    this.audio = audio;
    this.keys = {};
    this.dynamics = []; // { mesh, body }
    this.disposables = [];
    this.camMode = 0;
    this.steer = 0;
    this.timerState = 'pre';
    this.timerStart = 0;
    this.splashCooldown = 0;
  }

  // ---------------------------------------------------------- setup
  start() {
    const renderer = this.renderer;
    renderer.toneMappingExposure = 0.75;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 2500);
    this.camera.position.set(0, 3, START_Z - 8);

    this.buildSky();
    this.buildPhysicsWorld();
    this.buildTerrain();
    this.buildCourse();
    this.buildVehicle();
    this.buildScenery();

    this.audio.ensure();
    this.audio.setProfile(this.car.spec.soundProfile);

    this.onKeyDown = (e) => this.handleKey(e, true);
    this.onKeyUp = (e) => this.handleKey(e, false);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    document.getElementById('drive-ui').classList.remove('hidden');
    document.getElementById('back-btn').onclick = () => this.onExit();
    this.toast(`${this.car.spec.drivetrain} · ${this.car.spec.engineHp} hp — course ahead. Go!`, 3500);

    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.tick());
  }

  buildSky() {
    const sky = new Sky();
    sky.scale.setScalar(2000);
    const sun = new THREE.Vector3();
    const elevation = 21, azimuth = 145;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms.sunPosition.value.copy(sun);
    sky.material.uniforms.turbidity.value = 6;
    sky.material.uniforms.rayleigh.value = 1.8;
    sky.material.uniforms.mieCoefficient.value = 0.004;
    sky.material.uniforms.mieDirectionalG.value = 0.85;
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog(0xc4d3de, 220, 1400);

    // environment lighting baked from the sky itself
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(2000);
    envSky.material.uniforms.sunPosition.value.copy(sun);
    envScene.add(envSky);
    this.envTex = this.pmrem.fromScene(envScene).texture;
    this.scene.environment = this.envTex;

    this.sunDir = sun.clone().normalize();
    this.sunLight = new THREE.DirectionalLight(0xfff3e0, 3.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const cam = this.sunLight.shadow.camera;
    cam.left = -55; cam.right = 55; cam.top = 55; cam.bottom = -55;
    cam.near = 1; cam.far = 400;
    this.sunLight.shadow.bias = -0.0004;
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunLight, this.sunTarget);
    this.sunLight.target = this.sunTarget;

    this.scene.add(new THREE.HemisphereLight(0xbcd4e8, 0x6b6248, 0.55));
  }

  buildPhysicsWorld() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.35;
    this.world.defaultContactMaterial.restitution = 0.05;

    // NOTE: do NOT use an infinite CANNON.Plane for the ground — the RaycastVehicle's
    // wheel rays misbehave against a plane half-space and the car gets tripped and
    // launched off the ground (it would stall a few meters past the start). A large
    // flat box with its top surface at y=0 is stable across the whole course.
    const ground = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(200, 5, 400)),
      position: new CANNON.Vec3(0, -5, 150),
    });
    this.world.addBody(ground);
  }

  // ---------------------------------------------------------- terrain
  buildTerrain() {
    const grassTex = makeCanvasTexture(512, noisePaint('#5a7d3a', [
      ['#4c6e30', 1400, 1, 3], ['#6b9145', 1100, 1, 3], ['#3f5d27', 600, 1, 2],
    ]), 160, 160);
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.02, 150);
    grass.receiveShadow = true;
    this.scene.add(grass);

    const asphaltTex = makeCanvasTexture(512, noisePaint('#3c3f43', [
      ['#33363a', 1600, 1, 3], ['#4a4d52', 1300, 1, 2.5], ['#56595e', 350, 0.5, 1.5],
    ]), 4, 130);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, 460),
      new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.0, 150);
    road.receiveShadow = true;
    this.scene.add(road);

    // lane markings
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8 });
    const dashGeo = new THREE.PlaneGeometry(0.18, 3);
    for (let z = -70; z < 380; z += 9) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.012, z);
      this.scene.add(dash);
    }
    const edgeGeo = new THREE.PlaneGeometry(0.16, 460);
    for (const x of [-ROAD_W / 2 + 0.3, ROAD_W / 2 - 0.3]) {
      const edge = new THREE.Mesh(edgeGeo, dashMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.012, 150);
      this.scene.add(edge);
    }

    this.buildOffroadField();
  }

  buildOffroadField() {
    // physics heightfield + exactly matching visual mesh
    const nx = 27, nz = 71, elem = 2;
    const x0 = 24, z0 = 226; // field spans x: 24..76, z: 226 down to 226-140=86
    const matrix = [];
    const heightAt = (i, j) => {
      const fx = Math.min(i, nx - 1 - i) / 5;
      const fz = Math.min(j, nz - 1 - j) / 6;
      const falloff = Math.min(1, fx) * Math.min(1, fz);
      return falloff * (
        0.55 * Math.sin(i * 0.55) * Math.cos(j * 0.48)
        + 0.45 * Math.sin(i * 0.21 + j * 0.33)
        + 0.18 * Math.sin(i * 1.3 + j * 0.9)
        + 0.65
      );
    };
    for (let i = 0; i < nx; i++) {
      matrix.push([]);
      for (let j = 0; j < nz; j++) matrix[i].push(Math.max(0, heightAt(i, j)));
    }
    const hfShape = new CANNON.Heightfield(matrix, { elementSize: elem });
    const hfBody = new CANNON.Body({ mass: 0, shape: hfShape });
    hfBody.position.set(x0, 0, z0);
    hfBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(hfBody);

    // visual: vertices placed at the exact world positions of the field
    const geo = new THREE.BufferGeometry();
    const verts = [], uvs = [], idx = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        verts.push(x0 + i * elem, matrix[i][j], z0 - j * elem);
        uvs.push(i / (nx - 1) * 8, j / (nz - 1) * 20);
      }
    }
    for (let i = 0; i < nx - 1; i++) {
      for (let j = 0; j < nz - 1; j++) {
        const a = i * nz + j, b = (i + 1) * nz + j, c = (i + 1) * nz + j + 1, d = i * nz + j + 1;
        idx.push(a, b, d, b, c, d);
      }
    }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const dirtTex = makeCanvasTexture(512, noisePaint('#8a6a44', [
      ['#7a5c38', 1500, 1, 3], ['#9c7b50', 1200, 1, 3], ['#6b4f2e', 500, 1, 2],
    ]));
    const dirt = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: dirtTex, roughness: 1,
    }));
    dirt.receiveShadow = true;
    this.scene.add(dirt);

    this.makeSign('OFF-ROAD →', 8.2, 86, 0xc97b29, 0.6);
  }

  // ---------------------------------------------------------- helpers
  addBlock(sx, sy, sz, pos, { mass = 0, color = 0x888888, quat = null, rough = 0.7, metal = 0.1 } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }),
    );
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
      position: new CANNON.Vec3(pos.x, pos.y, pos.z),
    });
    if (quat) { body.quaternion.copy(quat); mesh.quaternion.copy(quat); }
    this.world.addBody(body);
    if (mass > 0) this.dynamics.push({ mesh, body });
    return { mesh, body };
  }

  makeSign(text, x, z, color = 0x18b4e8, scale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10151c';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.strokeStyle = '#' + new THREE.Color(color).getHexString();
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 1008, 176);
    ctx.fillStyle = '#f2f5f8';
    ctx.font = 'bold 110px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 100);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const w = 9 * scale, h = 1.7 * scale;
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.6 }),
    );
    banner.position.set(x, 4.4, z);
    banner.rotation.y = Math.PI;
    this.scene.add(banner);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x444b54, metalness: 0.7, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.3, 10), postMat);
      post.position.set(x + side * (w / 2 + 0.2), 2.65, z);
      post.castShadow = true;
      this.scene.add(post);
      const pb = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Cylinder(0.09, 0.09, 5.3, 8),
        position: new CANNON.Vec3(x + side * (w / 2 + 0.2), 2.65, z),
      });
      this.world.addBody(pb);
    }
  }

  // ---------------------------------------------------------- course
  buildCourse() {
    this.makeSign('START', 0, 0, 0x2ecc71, 1.4);
    this.makeSign('SLALOM', 0, 20, 0x18b4e8, 1.2);

    // traffic cones down the centerline
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xe8641e, roughness: 0.6 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const z = 28 + i * 9;
      const cone = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.17, 0.52, 14), coneMat);
      c.position.y = 0.06;
      c.castShadow = true;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), baseMat);
      base.position.y = -0.245;
      cone.add(c, base);
      cone.position.set(0, 0.3, z);
      this.scene.add(cone);
      const body = new CANNON.Body({
        mass: 1.4,
        shape: new CANNON.Cylinder(0.06, 0.18, 0.56, 10),
        position: new CANNON.Vec3(0, 0.3, z),
        angularDamping: 0.3,
      });
      this.world.addBody(body);
      this.dynamics.push({ mesh: cone, body });
    }

    // speed bumps
    this.makeSign('SPEED BUMPS', 0, 80, 0xf0b428, 1.1);
    const bumpMat = new THREE.MeshStandardMaterial({ color: 0xd6c12f, roughness: 0.85 });
    for (const z of [88, 95, 102]) {
      const bump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, ROAD_W - 1, 20).rotateZ(Math.PI / 2),
        bumpMat,
      );
      bump.position.set(0, 0.03, z);
      bump.castShadow = true;
      this.scene.add(bump);
      const q = new CANNON.Quaternion().setFromEuler(0, 0, Math.PI / 2);
      const body = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, 0.03, z) });
      body.addShape(new CANNON.Cylinder(0.22, 0.22, ROAD_W - 1, 12), new CANNON.Vec3(), q);
      this.world.addBody(body);
    }

    // jump ramp (kicker)
    this.makeSign('BIG AIR', 0, 112, 0xe84393, 1.2);
    const rampQ = new CANNON.Quaternion().setFromEuler(-0.16, 0, 0);
    this.addBlock(7, 0.3, 9, new THREE.Vector3(0, 0.62, 122), {
      color: 0x9aa3ad, quat: rampQ, metal: 0.4, rough: 0.5,
    });

    // crate wall
    this.makeSign('BREAKTHROUGH', 0, 145, 0xa55eea, 1.1);
    const crateColors = [0xb08a55, 0xa57c47, 0xc09a64];
    const rows = [4, 3, 2, 1];
    rows.forEach((count, layer) => {
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 0.78;
        this.addBlock(0.74, 0.74, 0.74, new THREE.Vector3(x, 0.38 + layer * 0.75, 152), {
          mass: 5, color: crateColors[(i + layer) % 3], rough: 0.85,
        });
      }
    });

    // seesaw
    this.makeSign('SEESAW', 0, 168, 0x18b4e8, 1.1);
    const fulcrum = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, 0.45, 177) });
    const fq = new CANNON.Quaternion().setFromEuler(0, 0, Math.PI / 2);
    fulcrum.addShape(new CANNON.Cylinder(0.42, 0.42, 3, 14), new CANNON.Vec3(), fq);
    this.world.addBody(fulcrum);
    const fulMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 3, 20).rotateZ(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.5, roughness: 0.5 }),
    );
    fulMesh.position.set(0, 0.45, 177);
    fulMesh.castShadow = true;
    this.scene.add(fulMesh);

    const plank = this.addBlock(3, 0.14, 7.5, new THREE.Vector3(0, 0.95, 177), {
      mass: 260, color: 0x8a6f4d, rough: 0.85,
    });
    const hinge = new CANNON.HingeConstraint(plank.body, fulcrum, {
      pivotA: new CANNON.Vec3(0, -0.07, 0),
      axisA: new CANNON.Vec3(1, 0, 0),
      pivotB: new CANNON.Vec3(0, 0.45, 0),
      axisB: new CANNON.Vec3(1, 0, 0),
    });
    this.world.addConstraint(hinge);

    // water-gap bridge
    this.makeSign('NARROW BRIDGE', 0, 192, 0x18b4e8, 1.1);
    const deckColor = 0x7d8590;
    this.addBlock(4.5, 0.3, 7, new THREE.Vector3(0, 0.45, 201), {
      color: deckColor, quat: new CANNON.Quaternion().setFromEuler(-0.17, 0, 0), metal: 0.3, rough: 0.5,
    });
    this.addBlock(3.4, 0.3, 26, new THREE.Vector3(0, 1.18, 217), { color: deckColor, metal: 0.3, rough: 0.5 });
    this.addBlock(4.5, 0.3, 7, new THREE.Vector3(0, 0.45, 233), {
      color: deckColor, quat: new CANNON.Quaternion().setFromEuler(0.17, 0, 0), metal: 0.3, rough: 0.5,
    });
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 30),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a6f95, roughness: 0.12, metalness: 0.1,
        transparent: true, opacity: 0.92, envMapIntensity: 1.4,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, 217);
    this.scene.add(water);

    // barrel field
    this.makeSign('BARRELS', 0, 248, 0xe8641e, 1.1);
    const barrelColors = [0x2471a3, 0xc0392b, 0xd68910];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 2.6 + (row % 2) * 1.3;
        const z = 256 + row * 4;
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.33, 0.33, 0.95, 18),
          new THREE.MeshStandardMaterial({
            color: barrelColors[(row + i) % 3], metalness: 0.55, roughness: 0.4,
          }),
        );
        mesh.position.set(x, 0.5, z);
        mesh.castShadow = true;
        this.scene.add(mesh);
        const body = new CANNON.Body({
          mass: 16,
          shape: new CANNON.Cylinder(0.33, 0.33, 0.95, 12),
          position: new CANNON.Vec3(x, 0.5, z),
          angularDamping: 0.25,
        });
        this.world.addBody(body);
        this.dynamics.push({ mesh, body });
      }
    }

    this.makeSign('FINISH', 0, FINISH_Z, 0x2ecc71, 1.4);

    // painted skidpad for donuts past the finish
    const pad = new THREE.Mesh(
      new THREE.RingGeometry(6, 6.5, 48),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(-22, 0.015, 350);
    this.scene.add(pad);
    const padFloor = new THREE.Mesh(
      new THREE.CircleGeometry(11, 48),
      new THREE.MeshStandardMaterial({
        map: makeCanvasTexture(512, noisePaint('#3c3f43', [
          ['#33363a', 1600, 1, 3], ['#4a4d52', 1300, 1, 2.5],
        ]), 3, 3),
        roughness: 0.95,
      }),
    );
    padFloor.rotation.x = -Math.PI / 2;
    padFloor.position.set(-22, 0.008, 350);
    padFloor.receiveShadow = true;
    this.scene.add(padFloor);
  }

  buildScenery() {
    // distant hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 1 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.4;
      const r = 620 + (i % 3) * 140;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), hillMat);
      hill.scale.set(180 + (i % 4) * 60, 55 + (i % 3) * 30, 160);
      hill.position.set(Math.cos(a) * r, -8, 150 + Math.sin(a) * r);
      this.scene.add(hill);
    }

    // trees flanking the course
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4327, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e5e2a, roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.4, 8);
    const leafGeo = new THREE.ConeGeometry(1.7, 3.6, 10);
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      let x = side * (16 + rand() * 90);
      const z = -50 + rand() * 430;
      if (x > 18 && x < 82 && z > 80 && z < 232) x += 75; // keep off the dirt field
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.2;
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.y = 4;
      leaves.castShadow = true;
      tree.add(trunk, leaves);
      const s = 0.8 + rand() * 0.9;
      tree.scale.setScalar(s);
      tree.position.set(x, 0, z);
      this.scene.add(tree);
    }
  }

  // ---------------------------------------------------------- vehicle
  buildVehicle() {
    this.car = buildCar(this.config);
    const spec = this.car.spec;

    this.scene.add(this.car.bodyGroup);
    this.car.bodyGroup.position.set(0, 0, 0);
    for (const w of this.car.wheels) this.scene.add(w);

    const chassisBody = new CANNON.Body({ mass: spec.mass, allowSleep: false });
    const beltHalf = (spec.beltY - spec.bottomY) / 2;
    chassisBody.addShape(
      new CANNON.Box(new CANNON.Vec3(spec.width / 2 - 0.05, beltHalf, spec.length / 2 - 0.05)),
      new CANNON.Vec3(0, (spec.beltY + spec.bottomY) / 2, 0),
    );
    const cab = spec.cabin;
    chassisBody.addShape(
      new CANNON.Box(new CANNON.Vec3(spec.width * 0.40, (cab.topY - spec.beltY) / 2, (cab.z1 - cab.z0) / 2 - 0.05)),
      new CANNON.Vec3(0, (cab.topY + spec.beltY) / 2, (cab.z0 + cab.z1) / 2),
    );
    chassisBody.position.set(0, 1.3, START_Z);
    this.chassisBody = chassisBody;

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const susp = spec.suspension;
    const wheelOptions = {
      radius: spec.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: susp.stiffness,
      suspensionRestLength: susp.restLength,
      frictionSlip: spec.frictionSlip,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 200000,
      rollInfluence: spec.rollInfluence,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      maxSuspensionTravel: susp.restLength * 0.8,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };
    const t = spec.track / 2, wb = spec.wheelbase / 2, cy = spec.connY;
    for (const [x, z] of [[-t, wb], [t, wb], [-t, -wb], [t, -wb]]) {
      wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(x, cy, z);
      this.vehicle.addWheel({ ...wheelOptions });
    }
    this.vehicle.addToWorld(this.world);

    this.drivenWheels = spec.drivetrain === 'AWD' ? [0, 1, 2, 3]
      : spec.drivetrain === 'FWD' ? [0, 1] : [2, 3];
  }

  // ---------------------------------------------------------- input
  handleKey(e, down) {
    const k = e.key.toLowerCase();
    this.keys[k] = down;
    if (!down) return;
    if (k === 'escape') { this.onExit(); return; }
    if (k === 'c') this.camMode = (this.camMode + 1) % 3;
    if (k === 'r') this.flipUpright();
    if (k === 't') this.respawn(new CANNON.Vec3(0, 1.2, START_Z), 0);
    if (k === 'm') {
      const muted = this.audio.toggleMute();
      this.toast(muted ? 'Audio muted' : 'Audio on', 1200);
    }
    if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
    }
  }

  flipUpright() {
    const pos = this.chassisBody.position;
    const fwd = new CANNON.Vec3(0, 0, 1);
    this.chassisBody.quaternion.vmult(fwd, fwd);
    const yaw = Math.atan2(fwd.x, fwd.z);
    this.respawn(new CANNON.Vec3(pos.x, pos.y + 1.2, pos.z), yaw);
  }

  respawn(pos, yaw) {
    this.chassisBody.position.copy(pos);
    this.chassisBody.quaternion.setFromEuler(0, yaw, 0);
    this.chassisBody.velocity.setZero();
    this.chassisBody.angularVelocity.setZero();
  }

  toast(msg, ms = 2000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ---------------------------------------------------------- loop
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const spec = this.car.spec;
    const vehicle = this.vehicle;
    const body = this.chassisBody;

    const velocity = body.velocity;
    const speed = velocity.length();
    const speedKmh = speed * 3.6;

    // --- controls ---
    const throttle = (this.keys['w'] || this.keys['arrowup']) ? 1 : 0;
    const brakeKey = (this.keys['s'] || this.keys['arrowdown']) ? 1 : 0;
    const left = (this.keys['a'] || this.keys['arrowleft']) ? 1 : 0;
    const right = (this.keys['d'] || this.keys['arrowright']) ? 1 : 0;
    const handbrake = this.keys[' '] ? 1 : 0;

    const maxSteer = Math.max(0.14, 0.6 / (1 + speed * 0.045));
    const steerTarget = (left - right) * maxSteer;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 9);
    vehicle.setSteeringValue(this.steer, 0);
    vehicle.setSteeringValue(this.steer, 1);

    // forward velocity in local space decides brake vs reverse
    const fwd = new CANNON.Vec3(0, 0, 1);
    body.quaternion.vmult(fwd, fwd);
    const fwdSpeed = velocity.dot(fwd);

    let force = 0;
    let brake = 0;
    const topMs = spec.topSpeedKmh / 3.6;
    if (throttle) {
      force = spec.maxEngineForce;
      if (spec.instantTorque && speed < topMs * 0.4) force *= 1.3;
      force *= Math.max(0, 1 - Math.pow(Math.max(0, fwdSpeed) / topMs, 6));
    } else if (brakeKey) {
      if (fwdSpeed > 1.0) brake = spec.mass * 6;
      else force = -spec.maxEngineForce * 0.45;
    } else {
      brake = spec.mass * 0.06; // rolling resistance / engine braking
    }

    // cannon-es derives the wheel's forward roll as cross(axle, direction) = -Z
    // given our axleLocal +X / directionLocal -Y, so a positive engine force drives
    // toward -Z. Our course (and the car's nose) faces +Z, so negate to match.
    const perWheel = -force / this.drivenWheels.length;
    for (let i = 0; i < 4; i++) {
      vehicle.applyEngineForce(this.drivenWheels.includes(i) ? perWheel : 0, i);
      vehicle.setBrake(brake, i);
      // restore grip in case a previous handbrake reduced it
      vehicle.wheelInfos[i].frictionSlip = spec.frictionSlip;
    }
    if (handbrake) {
      for (const i of [2, 3]) {
        vehicle.setBrake(spec.mass * 9, i);
        vehicle.wheelInfos[i].frictionSlip = spec.frictionSlip * 0.55;
      }
    }

    // aero downforce from the spoiler
    if (spec.downforce > 0 && speed > 8) {
      body.applyForce(new CANNON.Vec3(0, -spec.downforce * speed * speed * 0.9, 0), body.position);
    }

    this.world.step(1 / 60, dt, 5);

    // --- sync visuals ---
    this.car.bodyGroup.position.copy(body.position);
    this.car.bodyGroup.quaternion.copy(body.quaternion);
    let sliding = false;
    for (let i = 0; i < 4; i++) {
      vehicle.updateWheelTransform(i);
      const tr = vehicle.wheelInfos[i].worldTransform;
      this.car.wheels[i].position.copy(tr.position);
      this.car.wheels[i].quaternion.copy(tr.quaternion);
      if (vehicle.wheelInfos[i].sliding) sliding = true;
    }
    for (const d of this.dynamics) {
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);
    }

    // --- sun shadow follows the car ---
    const carPos = this.car.bodyGroup.position;
    this.sunTarget.position.copy(carPos);
    this.sunLight.position.copy(carPos).addScaledVector(this.sunDir, 160);

    // --- camera ---
    this.updateCamera(dt, speed);

    // --- hazards / timer / HUD ---
    this.checkHazards(dt, carPos);
    this.updateTimer(carPos);
    this.updateHUD(speedKmh, throttle);

    const rpm01 = this.computeRpm(speedKmh, throttle);
    this.audio.update(rpm01, throttle, speedKmh, sliding || handbrake === 1);

    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(dt, speed) {
    const body = this.chassisBody;
    const pos = new THREE.Vector3().copy(body.position);
    const quat = new THREE.Quaternion().copy(body.quaternion);
    const alpha = 1 - Math.exp(-dt * 5);

    if (this.camMode === 0) { // chase
      const dist = 7 + speed * 0.12;
      const offset = new THREE.Vector3(0, 2.6, -dist).applyQuaternion(quat);
      this.camera.position.lerp(pos.clone().add(offset), alpha);
      if (this.camera.position.y < 0.5) this.camera.position.y = 0.5;
      const look = pos.clone().add(new THREE.Vector3(0, 1.0, 4).applyQuaternion(quat));
      this.camera.lookAt(look);
    } else if (this.camMode === 1) { // hood
      const offset = new THREE.Vector3(0, 0.75, 0.6).applyQuaternion(quat);
      this.camera.position.copy(pos).add(offset);
      const look = pos.clone().add(new THREE.Vector3(0, 0.6, 30).applyQuaternion(quat));
      this.camera.lookAt(look);
    } else { // aerial
      this.camera.position.lerp(pos.clone().add(new THREE.Vector3(0, 42, -16)), alpha);
      this.camera.lookAt(pos);
    }
  }

  checkHazards(dt, carPos) {
    this.splashCooldown -= dt;
    // fell in the water at the bridge
    if (carPos.z > 203 && carPos.z < 231 && Math.abs(carPos.x) > 1.9
      && Math.abs(carPos.x) < 9 && carPos.y < 0.75 && this.splashCooldown <= 0) {
      this.splashCooldown = 3;
      this.toast('SPLASH! Recovered to the bridge approach.', 2500);
      setTimeout(() => this.respawn(new CANNON.Vec3(0, 1.2, 196), 0), 900);
    }
    // fell off the world somehow
    if (carPos.y < -15) this.respawn(new CANNON.Vec3(0, 1.2, START_Z), 0);
  }

  updateTimer(carPos) {
    const el = document.getElementById('timer');
    if (this.timerState === 'pre' && carPos.z > 0 && carPos.z < 5) {
      this.timerState = 'running';
      this.timerStart = performance.now();
    } else if (this.timerState === 'running') {
      const tsec = (performance.now() - this.timerStart) / 1000;
      el.textContent = tsec.toFixed(1) + 's';
      if (carPos.z > FINISH_Z) {
        this.timerState = 'done';
        const best = parseFloat(localStorage.getItem('forge-best') || '99999');
        if (tsec < best) {
          localStorage.setItem('forge-best', tsec.toFixed(2));
          this.toast(`FINISH — ${tsec.toFixed(2)}s · NEW BEST!`, 4000);
        } else {
          this.toast(`FINISH — ${tsec.toFixed(2)}s (best ${best.toFixed(2)}s)`, 4000);
        }
        el.textContent = '';
      }
    }
    if (this.timerState === 'done' && carPos.z < 0) this.timerState = 'pre';
  }

  computeRpm(speedKmh, throttle) {
    const spec = this.car.spec;
    if (spec.soundProfile === 'ev') {
      return Math.min(1, speedKmh / spec.topSpeedKmh);
    }
    const gears = [[0, 32], [24, 60], [50, 95], [82, 135], [118, 185], [160, 400]];
    let g = gears.findIndex(([lo, hi]) => speedKmh >= lo && speedKmh < hi);
    if (g < 0) g = gears.length - 1;
    const [lo, hi] = gears[g];
    const frac = (speedKmh - lo) / (hi - lo);
    this.gear = speedKmh < 1 ? 'N' : String(g + 1);
    return Math.min(1, 0.12 + frac * 0.8 + throttle * 0.08);
  }

  updateHUD(speedKmh, throttle) {
    document.getElementById('speed-value').textContent = Math.round(speedKmh);
    document.getElementById('gear').textContent = this.car.spec.soundProfile === 'ev'
      ? 'D' : (this.gear || 'N');
    const rpm = this.computeRpm(speedKmh, throttle);
    document.getElementById('rpm-fill').style.width = (rpm * 100) + '%';
    document.getElementById('rpm-fill').classList.toggle('redline', rpm > 0.85);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  stop() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.audio.idle();
    disposeObject(this.scene);
    this.envTex.dispose();
    this.pmrem.dispose();
    document.getElementById('drive-ui').classList.add('hidden');
    document.getElementById('timer').textContent = '';
  }
}
