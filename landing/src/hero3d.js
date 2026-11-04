// Escena 3D de la portada: el logo de Movo (la M y la flecha que sube) en volumen, rodeado de
// avisos bancarios que giran a su alrededor. Al bajar, los avisos caen hacia el logo: Movo los lee.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNoticeTextures } from './noticeTextures.js';

const BACKGROUND = 0x1b1066;
const LOGO_CENTER = { x: 262, y: 271 }; // centro del dibujo del logo (ver web/src/presentation/components/Logo.jsx)
const LOGO_UNIT = 60; // unidades del SVG por unidad de la escena
const STROKE_RADIUS = 24 / LOGO_UNIT;
const LETTER_STROKES = [
  [
    [136, 366],
    [136, 200],
    [252, 322],
    [368, 206],
  ],
];
const ARROW_STROKES = [
  [
    [368, 366],
    [368, 168],
  ],
  [
    [327, 209],
    [368, 168],
    [409, 209],
  ],
];
const NOTICE_COUNT = 22;
const DUST_COUNT = 260;

const toScene = ([svgX, svgY]) =>
  new THREE.Vector3((svgX - LOGO_CENTER.x) / LOGO_UNIT, -(svgY - LOGO_CENTER.y) / LOGO_UNIT, 0);

/** Convierte trazos del SVG en tubos redondeados: un cilindro por tramo y una esfera en cada vértice. */
function strokeGeometry(strokes) {
  const parts = [];
  for (const stroke of strokes) {
    const points = stroke.map(toScene);
    points.forEach((point, index) => {
      parts.push(new THREE.SphereGeometry(STROKE_RADIUS, 32, 16).translate(point.x, point.y, point.z));
      const next = points[index + 1];
      if (!next) return;
      const length = point.distanceTo(next);
      const segment = new THREE.CylinderGeometry(STROKE_RADIUS, STROKE_RADIUS, length, 32, 1, true);
      const direction = next.clone().sub(point).normalize();
      segment.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
      const middle = point.clone().add(next).multiplyScalar(0.5);
      parts.push(segment.translate(middle.x, middle.y, middle.z));
    });
  }
  return mergeGeometries(parts.map((part) => part.toNonIndexed()));
}

function createLogo() {
  const logo = new THREE.Group();
  const letter = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  const arrow = new THREE.MeshPhysicalMaterial({
    color: 0x6ee7b7,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  logo.add(new THREE.Mesh(strokeGeometry(LETTER_STROKES), letter));
  logo.add(new THREE.Mesh(strokeGeometry(ARROW_STROKES), arrow));
  return logo;
}

/** Los avisos: tarjetas planas con el texto de una notificación, cada una en su órbita. */
function createNotices() {
  const textures = createNoticeTextures();
  const geometry = new THREE.PlaneGeometry(2.6, 0.98);
  const materials = textures.map(
    (texture) =>
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide }),
  );
  return Array.from({ length: NOTICE_COUNT }, (_, index) => {
    const mesh = new THREE.Mesh(geometry, materials[index % materials.length]);
    mesh.userData = {
      angle: (index / NOTICE_COUNT) * Math.PI * 2 + Math.random() * 0.3,
      radius: 3.8 + Math.random() * 2.6,
      height: (Math.random() - 0.5) * 7,
      speed: 0.05 + Math.random() * 0.07,
      tilt: (Math.random() - 0.5) * 0.6,
      delay: Math.random() * 0.8,
    };
    return mesh;
  });
}

/** Polvo de luz menta que flota despacio detrás de todo. */
function createDust() {
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] = (Math.random() - 0.5) * 34;
    positions[index + 1] = (Math.random() - 0.5) * 20;
    positions[index + 2] = -4 - Math.random() * 10;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x6ee7b7, size: 0.06, transparent: true, opacity: 0.7 });
  return new THREE.Points(geometry, material);
}

function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(BACKGROUND, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

function createStage(renderer) {
  const scene = new THREE.Scene();
  const environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 8);
  const rim = new THREE.DirectionalLight(0xff8fbd, 1.4);
  rim.position.set(-6, -2, -4);
  scene.add(key, rim, new THREE.HemisphereLight(0xb8a8ff, 0x1b1066, 0.6));
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 18);
  return { scene, camera };
}

/** Coloca el grupo según la pantalla: a la derecha en escritorio, arriba en el teléfono. */
function layoutFor(width, height) {
  const aspect = width / height;
  if (aspect < 0.9) return { x: 0, y: 3.2, scale: 0.5 };
  if (aspect < 1.3) return { x: 2.6, y: 1.4, scale: 0.8 };
  return { x: 5.8, y: 0.4, scale: 0.84 };
}

function updateNotices(notices, { time, delta, scroll, intro }) {
  for (const notice of notices) {
    const data = notice.userData;
    data.angle += data.speed * delta;
    const arrival = THREE.MathUtils.clamp((intro - data.delay) / 1.2, 0, 1);
    const entry = 1 - (1 - arrival) ** 3;
    const pull = 1 - scroll * 0.92; // al bajar, los avisos se acercan al logo
    const radius = data.radius * pull + (1 - entry) * 12;
    notice.position.set(
      Math.cos(data.angle) * radius * 0.7,
      data.height * pull + Math.sin(time * 0.6 + data.angle) * 0.25,
      Math.sin(data.angle) * radius * 0.55 - 1,
    );
    notice.rotation.set(data.tilt, -data.angle * 0.35 + Math.sin(time * 0.4) * 0.1, data.tilt * 0.5);
    notice.scale.setScalar(Math.max(0.001, entry * (1 - scroll * 0.85)));
  }
}

function trackPointer() {
  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  });
  return pointer;
}

export function createHeroScene(canvas, { reducedMotion }) {
  const renderer = createRenderer(canvas);
  const { scene, camera } = createStage(renderer);
  const world = new THREE.Group();
  const logo = createLogo();
  const notices = createNotices();
  world.add(logo, ...notices);
  scene.add(world, createDust());

  const pointer = trackPointer();
  const smooth = { x: 0, y: 0, scroll: 0 };
  const timer = new THREE.Timer();
  let layout = layoutFor(1, 1);
  let visible = true;

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = canvas;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    layout = layoutFor(width, height);
    if (reducedMotion) renderFrame();
  };

  function renderFrame() {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    const time = timer.getElapsed();
    const scrollTarget = THREE.MathUtils.clamp(window.scrollY / (canvas.clientHeight * 0.9), 0, 1);
    smooth.scroll += (scrollTarget - smooth.scroll) * 0.08;
    smooth.x += (pointer.x - smooth.x) * 0.05;
    smooth.y += (pointer.y - smooth.y) * 0.05;

    world.position.set(layout.x, layout.y + smooth.scroll * 1.5, 0);
    world.scale.setScalar(layout.scale);
    world.rotation.set(smooth.y * 0.18, smooth.x * 0.35, 0);
    logo.rotation.y = Math.sin(time * 0.5) * 0.25 + smooth.scroll * Math.PI * 0.6;
    logo.position.y = Math.sin(time * 0.9) * 0.15;
    updateNotices(notices, { time, delta, scroll: smooth.scroll, intro: reducedMotion ? 99 : time });
    renderer.render(scene, camera);
  }

  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(canvas);
  window.addEventListener('resize', resize);
  resize();
  if (reducedMotion) return;
  renderer.setAnimationLoop(() => {
    if (visible && !document.hidden) renderFrame();
  });
}
