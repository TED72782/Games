// ============================================================
// FORGE MOTORS — entry point & mode switching
// ============================================================

import * as THREE from 'three';
import { Designer } from './designer.js';
import { Drive } from './drive.js';
import { EngineAudio } from './audio.js';
import { defaultConfig } from './config.js';

const STORAGE_KEY = 'forge-car-config-v1';

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultConfig, ...saved };
  } catch {
    return { ...defaultConfig };
  }
}

const config = loadConfig();
const audio = new EngineAudio();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

let current = null;

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function showDesigner() {
  if (current) current.stop();
  current = new Designer(renderer, config, {
    onTestDrive: showDrive,
    onConfigChange: saveConfig,
  });
  current.start();
}

function showDrive() {
  if (current) current.stop();
  audio.ensure(); // user gesture (the button click) unlocks audio
  current = new Drive(renderer, config, { onExit: showDesigner }, audio);
  current.start();
}

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  if (current) current.resize();
});

if (location.hash === '#drive') showDrive();
else showDesigner();
document.getElementById('loading').classList.add('hidden');
