// ============================================================
// FORGE MOTORS — Design Studio (showroom scene + parts UI)
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BODIES, ENGINES, TIRES, RIMS, SUSPENSIONS, SPOILERS, FINISHES,
  SWATCHES, computeStats,
} from './config.js';
import { buildCar, disposeObject } from './carBuilder.js';

const SECTIONS = [
  { key: 'body', title: 'Body Style', catalog: BODIES, sub: (p) => p.tag },
  { key: 'engine', title: 'Engine', catalog: ENGINES, sub: (p) => p.desc },
  { key: 'tires', title: 'Tires', catalog: TIRES, sub: (p) => p.desc },
  { key: 'rims', title: 'Rims', catalog: RIMS, sub: (p) => p.desc },
  { key: 'suspension', title: 'Suspension', catalog: SUSPENSIONS, sub: (p) => p.desc },
  { key: 'spoiler', title: 'Spoiler', catalog: SPOILERS, sub: (p) => p.desc },
  { key: 'finish', title: 'Paint Finish', catalog: FINISHES, sub: (p) => p.desc },
];

export class Designer {
  constructor(renderer, config, { onTestDrive, onConfigChange }) {
    this.renderer = renderer;
    this.config = config;
    this.onTestDrive = onTestDrive;
    this.onConfigChange = onConfigChange;
    this.car = null;
  }

  start() {
    const renderer = this.renderer;
    renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);
    this.scene.fog = new THREE.Fog(0x0a0c10, 18, 42);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;

    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.set(5.6, 2.3, 6.2);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(0, 0.65, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.enablePan = false;

    // --- showroom set ---
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(22, 64),
      new THREE.MeshStandardMaterial({
        color: 0x101318, metalness: 0.75, roughness: 0.38, envMapIntensity: 0.9,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(4.3, 4.5, 0.16, 64),
      new THREE.MeshStandardMaterial({
        color: 0x1c2027, metalness: 0.6, roughness: 0.4, envMapIntensity: 0.8,
      }),
    );
    platform.position.y = -0.08;
    platform.receiveShadow = true;
    this.scene.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.45, 0.035, 12, 96).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0x101010, emissive: 0x37c8ff, emissiveIntensity: 2.2,
      }),
    );
    ring.position.y = 0.015;
    this.scene.add(ring);

    // --- light rig ---
    const key = new THREE.SpotLight(0xffffff, 420, 40, 0.55, 0.45, 1.6);
    key.position.set(7, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    this.scene.add(key);

    const fill = new THREE.PointLight(0x8ab8ff, 90, 30, 1.8);
    fill.position.set(-7, 4, -3);
    this.scene.add(fill);

    const rim = new THREE.SpotLight(0xfff2d8, 260, 40, 0.7, 0.5, 1.7);
    rim.position.set(-2, 6.5, -9);
    this.scene.add(rim);

    this.scene.add(new THREE.HemisphereLight(0x3a4658, 0x0c0e12, 0.5));

    this.rebuildCar();
    this.buildUI();

    document.getElementById('designer-ui').classList.remove('hidden');

    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.tick());
  }

  rebuildCar() {
    if (this.car) {
      this.scene.remove(this.car.group);
      disposeObject(this.car.group);
    }
    this.car = buildCar(this.config);
    this.car.group.traverse((o) => { o.castShadow = true; });
    this.scene.add(this.car.group);
  }

  applyChange(key, value) {
    this.config[key] = value;
    this.onConfigChange(this.config);
    this.rebuildCar();
    this.updateStats();
  }

  buildUI() {
    const panel = document.getElementById('parts-panel');
    panel.innerHTML = '';

    for (const section of SECTIONS) {
      const wrap = document.createElement('div');
      wrap.className = 'section';
      const h = document.createElement('h3');
      h.textContent = section.title;
      wrap.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'chip-grid';

      for (const [id, part] of Object.entries(section.catalog)) {
        const chip = document.createElement('button');
        chip.className = 'chip' + (this.config[section.key] === id ? ' selected' : '');
        chip.innerHTML = `<span class="chip-name">${part.name}</span>`
          + `<span class="chip-sub">${section.sub(part)}</span>`;
        chip.addEventListener('click', () => {
          grid.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
          chip.classList.add('selected');
          this.applyChange(section.key, id);
        });
        grid.appendChild(chip);
      }
      wrap.appendChild(grid);
      panel.appendChild(wrap);
    }

    // paint swatches
    const wrap = document.createElement('div');
    wrap.className = 'section';
    const h = document.createElement('h3');
    h.textContent = 'Paint Color';
    wrap.appendChild(h);
    const sw = document.createElement('div');
    sw.className = 'swatch-grid';
    for (const color of SWATCHES) {
      const dot = document.createElement('button');
      dot.className = 'swatch' + (this.config.paint === color ? ' selected' : '');
      dot.style.background = color;
      dot.addEventListener('click', () => {
        sw.querySelectorAll('.swatch').forEach((d) => d.classList.remove('selected'));
        dot.classList.add('selected');
        this.applyChange('paint', color);
      });
      sw.appendChild(dot);
    }
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.className = 'swatch custom';
    custom.value = this.config.paint;
    custom.title = 'Custom color';
    custom.addEventListener('input', () => {
      sw.querySelectorAll('.swatch').forEach((d) => d.classList.remove('selected'));
      this.applyChange('paint', custom.value);
    });
    sw.appendChild(custom);
    wrap.appendChild(sw);
    panel.appendChild(wrap);

    this.updateStats();

    const btn = document.getElementById('test-drive-btn');
    btn.onclick = () => this.onTestDrive();
  }

  updateStats() {
    const s = computeStats(this.config);
    const body = BODIES[this.config.body];
    const panel = document.getElementById('stats-panel');

    const bar = (label, value, max, fmt) => `
      <div class="stat-row">
        <div class="stat-label"><span>${label}</span><span class="stat-val">${fmt}</span></div>
        <div class="stat-bar"><div style="width:${Math.min(100, (value / max) * 100)}%"></div></div>
      </div>`;

    panel.innerHTML = `
      <h2>${body.name}</h2>
      <p class="model-tag">${body.tag} · ${s.drivetrain}</p>
      ${bar('Power', s.hp, 800, s.hp + ' hp')}
      ${bar('Top Speed', s.top, 350, s.top + ' km/h')}
      ${bar('0–100 km/h', 16 - s.accel, 14, s.accel.toFixed(1) + ' s')}
      ${bar('Grip', s.grip, 3.6, s.grip.toFixed(2) + ' g')}
      ${bar('Off-Road', s.offroad * 100, 100, Math.round(s.offroad * 100) + '%')}
      <div class="stat-row plain">
        <div class="stat-label"><span>Weight</span><span class="stat-val">${s.weight} kg</span></div>
      </div>
      <div class="price">$${s.price.toLocaleString()}</div>
    `;
  }

  tick() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  stop() {
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    if (this.car) disposeObject(this.car.group);
    this.envTex.dispose();
    this.pmrem.dispose();
    document.getElementById('designer-ui').classList.add('hidden');
  }
}
