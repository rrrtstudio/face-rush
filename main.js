import * as THREE from "three";
import { RubiksCube, TARGET_ROUNDS, COLOR_DEFINITIONS } from "./cube.js";
import { CubeControls } from "./controls.js";
import { createScramble, applyScramble, moveToNotation } from "./scramble.js";
import { GameTimer } from "./timer.js";
import { findCompletedTargetFace } from "./judge.js";
import { Effects } from "./effects.js";
import { GameUI } from "./ui.js";
import { Haptics } from "./haptics.js";
import { chooseTargetColor, WHITE_FIXED_MODE } from "./config.js";

const ROUND_DELAY_MS = 1000;
const PIXEL_RATIO_LIMIT = 2;
const CUBE_TARGET = new THREE.Vector3(0, 0, 0);
const SUB_VIEW_BACKGROUND = new THREE.Color(0xf3f5ef);

const MAIN_VIEW = {
  label: "main",
  direction: new THREE.Vector3(5.4, 4.65, 7.6),
  desktopDistance: 8.0,
  mobileDistance: 10.8,
  fov: 40,
};

const SUB_VIEWS = [
  {
    label: "upper-front-left",
    canvas: document.querySelector("#subCanvas1"),
    direction: new THREE.Vector3(-5.4, 4.65, 7.6),
    distance: 8.1,
    fov: 42,
  },
  {
    label: "upper-back-right",
    canvas: document.querySelector("#subCanvas2"),
    direction: new THREE.Vector3(5.4, 4.65, -7.6),
    distance: 8.1,
    fov: 42,
  },
  {
    label: "lower-front-right",
    canvas: document.querySelector("#subCanvas3"),
    direction: new THREE.Vector3(5.4, -4.65, 7.6),
    distance: 8.3,
    fov: 43,
  },
];

const canvas = document.querySelector("#gameCanvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070907);
scene.fog = new THREE.FogExp2(0x070907, 0.035);

const renderer = createRenderer(canvas);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = createFixedCamera(MAIN_VIEW.direction, MAIN_VIEW.desktopDistance, MAIN_VIEW.fov);

const viewStats = {
  mainFrames: 0,
  subRenderBatches: 0,
  turnStarts: 0,
  turnCompletions: 0,
};

const cube = new RubiksCube({
  onMoveStart: handleMoveStart,
  onMoveComplete: handleMoveComplete,
});
scene.add(cube.group);

const timer = new GameTimer();
const ui = new GameUI({ totalRounds: TARGET_ROUNDS });
const effects = new Effects(scene);
const haptics = new Haptics({ enabled: ui.isVibrationEnabled() });

const controls = new CubeControls({
  camera,
  canvas,
  cube,
  inputEnabled: () => game.running && !game.transitioning,
  onOrientationChangeComplete: scheduleSubViewRender,
});

const subViews = SUB_VIEWS.map((view) => ({
  ...view,
  camera: createFixedCamera(view.direction, view.distance, view.fov),
  renderer: createRenderer(view.canvas, { preserveDrawingBuffer: true }),
}));

const game = {
  running: false,
  transitioning: false,
  clearCount: 0,
  scrambleLog: [],
  targetColor: WHITE_FIXED_MODE.colorName,
};

let lastFrame = performance.now();
let subRenderPending = false;
let subViewLighting = null;

createLighting();
createGround();
ui.bindActions({
  onStart: startGame,
  onReset: resetGame,
  onPreviewChange: handlePreviewChange,
  onVibrationChange: (enabled) => haptics.setEnabled(enabled),
});
resetGame();
requestAnimationFrame(animate);

function createRenderer(targetCanvas, options = {}) {
  const webglRenderer = new THREE.WebGLRenderer({
    canvas: targetCanvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
  });

  webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_LIMIT));
  webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
  return webglRenderer;
}

function createFixedCamera(direction, distance, fov) {
  const fixedCamera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  setCameraFromDirection(fixedCamera, direction, distance);
  return fixedCamera;
}

function setCameraFromDirection(targetCamera, direction, distance) {
  targetCamera.position.copy(direction).normalize().multiplyScalar(distance);
  targetCamera.lookAt(CUBE_TARGET);
}

function resizeRendererToCanvas(webglRenderer, targetCamera) {
  const targetCanvas = webglRenderer.domElement;
  const width = Math.max(1, targetCanvas.clientWidth);
  const height = Math.max(1, targetCanvas.clientHeight);

  targetCamera.aspect = width / height;
  targetCamera.updateProjectionMatrix();
  webglRenderer.setSize(width, height, false);
}

function createLighting() {
  const ambient = new THREE.HemisphereLight(0xffffff, 0x1b1510, 1.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(-4.2, 6.2, 5.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  const rim = new THREE.PointLight(0x18e0b5, 10, 14);
  rim.position.set(4, 2, -3);
  scene.add(rim);

  const warm = new THREE.PointLight(0xffcf48, 6, 12);
  warm.position.set(-3.5, -1.2, 4);
  scene.add(warm);

  subViewLighting = new THREE.Group();
  subViewLighting.visible = false;

  const subAmbient = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.8);
  subViewLighting.add(subAmbient);

  const subKey = new THREE.DirectionalLight(0xffffff, 2.8);
  subKey.position.set(3.5, 5.5, 4.5);
  subViewLighting.add(subKey);

  const subFill = new THREE.DirectionalLight(0xffffff, 1.5);
  subFill.position.set(-5, 2, -3.5);
  subViewLighting.add(subFill);

  scene.add(subViewLighting);
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.ShadowMaterial({ opacity: 0.22 })
  );
  ground.position.y = -2.02;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function resetGame() {
  game.running = false;
  game.transitioning = false;
  game.clearCount = 0;
  game.scrambleLog = [];
  game.targetColor = chooseTargetColor({ fixedWhite: ui.isWhiteFixed() });
  timer.reset();
  cube.resetSolved();
  ui.setTargetColor(game.targetColor, COLOR_DEFINITIONS[game.targetColor]);
  ui.setReady();
  scheduleSubViewRender();
}

function startGame() {
  effects.unlockAudio();
  timer.reset();
  game.running = true;
  game.transitioning = true;
  game.clearCount = 0;
  game.scrambleLog = [];
  ui.setRunning();
  ui.setClearCount(0);
  prepareRound();
  timer.start();
  game.transitioning = false;
}

function prepareRound() {
  game.targetColor = chooseTargetColor({ fixedWhite: ui.isWhiteFixed() });
  cube.resetSolved();

  let moves = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    cube.resetSolved();
    moves = createScramble();
    applyScramble(cube, moves);

    if (!findCompletedTargetFace(cube, game.targetColor)) break;
  }

  ui.setTargetColor(game.targetColor, COLOR_DEFINITIONS[game.targetColor]);
  game.scrambleLog.push(moves.map(moveToNotation));
  scheduleSubViewRender();
}

function handleMoveStart() {
  viewStats.turnStarts += 1;
}

function handleMoveComplete() {
  viewStats.turnCompletions += 1;
  scheduleSubViewRender();

  if (!game.running || game.transitioning) return;

  const completed = findCompletedTargetFace(cube, game.targetColor);
  if (!completed) {
    haptics.pulse("move");
    return;
  }

  game.transitioning = true;
  game.clearCount += 1;
  ui.setClearCount(game.clearCount);
  ui.showClear(game.clearCount);
  effects.flashStickers(completed.stickers);
  effects.createBurst(cube.getFaceCenter(completed.faceKey), game.targetColor);
  effects.playClearSound();

  if (game.clearCount >= TARGET_ROUNDS) {
    haptics.pulse("complete");
    const total = timer.stop();
    game.running = false;
    window.setTimeout(() => {
      ui.hideClear();
      ui.showResult(total);
      game.transitioning = false;
    }, ROUND_DELAY_MS);
    return;
  }

  haptics.pulse("clear");
  window.setTimeout(() => {
    ui.hideClear();
    prepareRound();
    game.transitioning = false;
  }, ROUND_DELAY_MS);
}

function scheduleSubViewRender() {
  if (subRenderPending) return;

  subRenderPending = true;
  requestAnimationFrame(() => {
    subRenderPending = false;
    renderSubViews();
  });
}

function renderSubViews() {
  const previousBackground = scene.background;
  const previousFog = scene.fog;

  scene.background = SUB_VIEW_BACKGROUND;
  scene.fog = null;
  subViewLighting.visible = true;

  for (const view of subViews) {
    const isCompact = view.canvas.clientWidth < 180;
    setCameraFromDirection(view.camera, view.direction, view.distance * (isCompact ? 1.3 : 1));
    view.camera.fov = view.fov + (isCompact ? 4 : 0);
    resizeRendererToCanvas(view.renderer, view.camera);
    view.renderer.render(scene, view.camera);
  }

  subViewLighting.visible = false;
  scene.background = previousBackground;
  scene.fog = previousFog;

  viewStats.subRenderBatches += 1;
}

function handlePreviewChange(visible) {
  requestAnimationFrame(() => {
    resize();
    if (visible) scheduleSubViewRender();
  });
}

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  const distance = width < 620 ? MAIN_VIEW.mobileDistance : MAIN_VIEW.desktopDistance;

  setCameraFromDirection(camera, MAIN_VIEW.direction, distance);
  camera.fov = width < 620 ? 43 : MAIN_VIEW.fov;
  resizeRendererToCanvas(renderer, camera);
  scheduleSubViewRender();

  // Keep sub cameras aimed after responsive layout changes; the sub renderers
  // still draw only through the scheduled one-shot update above.
  for (const view of subViews) {
    setCameraFromDirection(view.camera, view.direction, view.distance);
  }
}

function animate(now) {
  const deltaMs = Math.min(50, now - lastFrame);
  lastFrame = now;

  cube.update(deltaMs);
  effects.update(deltaMs);
  controls.update();

  if (timer.running) {
    ui.setTime(timer.getElapsed());
  }

  renderer.render(scene, camera);
  viewStats.mainFrames += 1;
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resize);
resize();

window.FaceRush = {
  getRenderStats: () => ({ ...viewStats }),
  getScrambleLog: () => structuredClone(game.scrambleLog),
  getTargetColor: () => ({
    name: game.targetColor,
    ...COLOR_DEFINITIONS[game.targetColor],
  }),
};
