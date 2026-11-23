import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createTanghulu, createStage } from './model.js';

const container = document.querySelector('#scene-container');
const loadingScreen = document.querySelector('#loading-screen');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
} catch (error) {
  loadingScreen.innerHTML = '<p>当前浏览器无法开启 WebGL</p><span>请使用支持硬件加速的现代浏览器查看</span>';
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 3.4;
controls.maxDistance = 24;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = Math.PI / 2.04;
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.55;

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04).texture;
scene.environment = environment;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight('#fff8ec', '#9b8c80', 1.8));
const keyLight = new THREE.DirectionalLight('#fff0dc', 3.2);
keyLight.position.set(-4.5, 8.5, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -7;
keyLight.shadow.camera.right = 7;
keyLight.shadow.camera.top = 7;
keyLight.shadow.camera.bottom = -7;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 25;
keyLight.shadow.bias = -0.00015;
keyLight.shadow.normalBias = 0.025;
keyLight.shadow.radius = 4;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight('#dce9ff', 1.7);
fillLight.position.set(5, 4, -5);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight('#fff4dc', 1.4);
rimLight.position.set(-5, 3, -4);
scene.add(rimLight);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ color: '#71503a', opacity: 0.12 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.078;
ground.receiveShadow = true;
scene.add(ground);
scene.add(createStage());

const tanghulu = createTanghulu();
tanghulu.group.rotation.y = -0.14;
scene.add(tanghulu.group);

function homeView() {
  const aspect = container.clientWidth / container.clientHeight;
  if (aspect < 0.8) return { position: new THREE.Vector3(7.6, 6.2, 13.6), target: new THREE.Vector3(0, 2.8, 0) };
  if (aspect < 1.25) return { position: new THREE.Vector3(6.6, 5.2, 11.2), target: new THREE.Vector3(0, 2.8, 0) };
  return { position: new THREE.Vector3(7.3, 5.0, 11.8), target: new THREE.Vector3(0, 2.75, 0) };
}

const initialView = homeView();
camera.position.copy(initialView.position);
controls.target.copy(initialView.target);
controls.update();

const partInfo = {
  all: { note: '三颗草莓、一层奶香、一层薄脆糖衣。点击食材，靠近看看。', offset: null },
  strawberry: { note: '草莓宽头朝下、尖端朝上。细腻果面逐颗布置果籽凹槽与浅金果籽。', offset: new THREE.Vector3(3.0, 1.3, 4.1) },
  milk: { note: '奶皮子是有波浪与卷边的薄片，前方开口让草莓的红色自然露出来。', offset: new THREE.Vector3(3.2, 0.9, 4.2) },
  sugar: { note: '透明糖衣使用真实透射与折射材质，并保留独立厚度与细小糖晶。', offset: new THREE.Vector3(-3.0, 1.1, 4.0) },
  bamboo: { note: '一根竖直竹签串起三颗草莓，表面带有顺着纤维生成的浅色木纹。', offset: new THREE.Vector3(3.0, 1.1, 4.2) },
};

const hotspotDefinitions = [
  { key: 'strawberry', label: '草莓 · 尖端朝上', part: 'strawberry' },
  { key: 'milk', label: '奶皮子', part: 'milk' },
  { key: 'sugar', label: '透明糖衣', part: 'sugar' },
];
const hotspotsContainer = document.querySelector('#hotspots');
const hotspotElements = hotspotDefinitions.map((definition) => {
  const button = document.createElement('button');
  button.className = 'hotspot';
  button.setAttribute('aria-label', `查看${definition.label}`);
  button.innerHTML = `<span class="hotspot-pin">+</span><span class="hotspot-label">${definition.label}</span>`;
  button.addEventListener('click', () => selectPart(definition.part, definition.key));
  hotspotsContainer.appendChild(button);
  return { ...definition, element: button };
});

let labelsVisible = true;
let exploded = false;
let cameraTween = null;
let activePart = 'all';
const projected = new THREE.Vector3();
const worldPosition = new THREE.Vector3();

function updateHotspots() {
  hotspotElements.forEach((hotspot) => {
    const anchor = tanghulu.anchors[hotspot.key];
    anchor.getWorldPosition(worldPosition);
    projected.copy(worldPosition).project(camera);
    const x = (projected.x * 0.5 + 0.5) * container.clientWidth;
    const y = (-projected.y * 0.5 + 0.5) * container.clientHeight;
    const visible = projected.z > -1 && projected.z < 1 && x > 22 && x < container.clientWidth - 22 && y > 92 && y < container.clientHeight - 92;
    hotspot.element.style.left = `${x}px`;
    hotspot.element.style.top = `${y}px`;
    hotspot.element.classList.toggle('visible', visible);
    hotspot.element.style.pointerEvents = visible ? 'auto' : 'none';
  });
}

function tweenCamera(position, target, duration = 1.15) {
  cameraTween = {
    startTime: performance.now(),
    duration: reduceMotion ? 0.01 : duration * 1000,
    fromPosition: camera.position.clone(),
    toPosition: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone(),
  };
}

function updateCameraTween(now) {
  if (!cameraTween) return;
  const tween = cameraTween;
  const raw = Math.min(1, (now - tween.startTime) / tween.duration);
  const eased = 1 - Math.pow(1 - raw, 3);
  camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
  controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
  if (raw >= 1) cameraTween = null;
}

function setAutoRotate(value) {
  controls.autoRotate = value;
  const button = document.querySelector('#auto-rotate');
  button.classList.toggle('active', value);
  button.setAttribute('aria-pressed', String(value));
}

function selectPart(part, anchorKey = part) {
  activePart = part;
  document.querySelectorAll('.ingredient').forEach((button) => button.classList.toggle('active', button.dataset.part === part));
  document.querySelector('#part-note').textContent = partInfo[part].note;
  setAutoRotate(false);

  if (part === 'all') {
    const home = homeView();
    tweenCamera(home.position, home.target);
    return;
  }
  const anchor = tanghulu.anchors[anchorKey];
  anchor.getWorldPosition(worldPosition);
  const target = worldPosition.clone();
  const position = target.clone().add(partInfo[part].offset);
  tweenCamera(position, target);
}

function resetView() {
  exploded = false;
  const explodeButton = document.querySelector('#explode-view');
  explodeButton.classList.remove('active');
  explodeButton.setAttribute('aria-pressed', 'false');
  selectPart('all');
  setAutoRotate(!reduceMotion);
}

function toggleExploded() {
  exploded = !exploded;
  const button = document.querySelector('#explode-view');
  button.classList.toggle('active', exploded);
  button.setAttribute('aria-pressed', String(exploded));
  if (exploded) {
    setAutoRotate(false);
    selectPart('all');
    setAutoRotate(false);
    tweenCamera(new THREE.Vector3(7.0, 5.8, 10.5), new THREE.Vector3(0, 2.85, 0));
    showToast('分层视图 · 糖衣、草莓与奶皮子分离');
  }
}

function toggleLabels() {
  labelsVisible = !labelsVisible;
  hotspotsContainer.classList.toggle('hidden', !labelsVisible);
  const button = document.querySelector('#toggle-labels');
  button.classList.toggle('active', labelsVisible);
  button.setAttribute('aria-pressed', String(labelsVisible));
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function captureView() {
  renderer.render(scene, camera);
  const source = renderer.domElement;
  const output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext('2d');
  const gradient = context.createRadialGradient(output.width * 0.52, output.height * 0.42, 0, output.width * 0.52, output.height * 0.42, output.width * 0.7);
  gradient.addColorStop(0, '#fffaf3');
  gradient.addColorStop(1, '#eee5da');
  context.fillStyle = gradient;
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(source, 0, 0);
  const scale = output.width / container.clientWidth;
  context.fillStyle = '#9f292c';
  context.font = `600 ${18 * scale}px serif`;
  context.fillText('糖露 TANGLU · DESSERT ARCHIVE 001', 34 * scale, 42 * scale);
  const link = document.createElement('a');
  link.download = `tanghulu-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = output.toDataURL('image/png');
  link.click();
  showToast('已保存当前视图');
}

document.querySelectorAll('.ingredient').forEach((button) => button.addEventListener('click', () => selectPart(button.dataset.part)));
document.querySelector('#reset-view').addEventListener('click', resetView);
document.querySelector('#auto-rotate').addEventListener('click', () => setAutoRotate(!controls.autoRotate));
document.querySelector('#explode-view').addEventListener('click', toggleExploded);
document.querySelector('#toggle-labels').addEventListener('click', toggleLabels);
document.querySelector('#capture-view').addEventListener('click', captureView);
controls.addEventListener('start', () => { cameraTween = null; });

const aboutDialog = document.querySelector('#about-dialog');
let autoBeforeDialog = false;
document.querySelector('#about-open').addEventListener('click', () => {
  autoBeforeDialog = controls.autoRotate;
  setAutoRotate(false);
  aboutDialog.showModal();
});
document.querySelector('#about-close').addEventListener('click', () => aboutDialog.close());
aboutDialog.addEventListener('click', (event) => {
  if (event.target !== aboutDialog) return;
  const bounds = aboutDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) aboutDialog.close();
});
aboutDialog.addEventListener('close', () => setAutoRotate(autoBeforeDialog));

window.addEventListener('keydown', (event) => {
  if (aboutDialog.open || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.code === 'Space') {
    event.preventDefault();
    setAutoRotate(!controls.autoRotate);
  } else if (event.key.toLowerCase() === 'r') resetView();
  else if (event.key.toLowerCase() === 'e') toggleExploded();
  else if (event.key.toLowerCase() === 'h') toggleLabels();
});

window.addEventListener('resize', () => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  if (activePart === 'all' && !exploded) {
    const home = homeView();
    camera.position.copy(home.position);
    controls.target.copy(home.target);
  }
});

const clock = new THREE.Clock();
function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  tanghulu.update(delta, exploded);
  updateCameraTween(now);
  controls.update(delta);
  updateHotspots();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.setTimeout(() => loadingScreen.classList.add('loaded'), 350);
  });
});

// Expose a small read-only diagnostic surface for automated checks.
window.__TANGLU__ = {
  get ready() { return true; },
  get meshes() { let count = 0; scene.traverse((object) => { if (object.isMesh) count += 1; }); return count; },
  get exploded() { return exploded; },
  get autoRotate() { return controls.autoRotate; },
  get activePart() { return activePart; },
  get strawberryOrientation() { return tanghulu.group.userData.strawberryOrientation; },
};
