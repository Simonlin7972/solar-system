import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { buildEverestTerrain } from './dem.js';
import { loadSatelliteTexture } from './satellite.js';
import { makeTerrainMaterial } from './terrainMaterial.js';
import { setupEnvironment } from './environment.js';
import { setupPost } from './postfx.js';

const loadingEl = document.getElementById('loading');
const barEl = document.querySelector('#bar i');
const setProgress = (p) => { barEl.style.width = `${Math.round(p * 100)}%`; };

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // 電影級色調映射
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 1, 12000);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 600;
controls.maxDistance = 5000;
controls.maxPolarAngle = Math.PI * 0.52;   // 不轉到地平線以下
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;           // 緩慢電影運鏡
controls.addEventListener('start', () => { controls.autoRotate = false; });

let composer, bokeh, summit, csm;

async function init() {
  // 1) 環境光（HDRI IBL + 霧）
  await setupEnvironment(renderer, scene);
  setProgress(0.3);

  // CSM 級聯陰影（取代單一陰影貼圖，近處銳利、遠處仍有陰影）
  csm = new CSM({
    parent: scene,
    camera,
    cascades: 3,
    maxFar: 8000,
    mode: 'practical',
    shadowMapSize: 2048,
    lightDirection: new THREE.Vector3(-0.6, -0.85, -0.42).normalize(),
    lightIntensity: 1.0,
    lightColor: new THREE.Color(0xfff2e0),
    lightFar: 9000,
    lightMargin: 2500,
    shadowBias: -0.0006,
  });

  // 2) 真實 DEM 地形 + 真實衛星影像 albedo
  const terrain = await buildEverestTerrain((p) => setProgress(0.3 + p * 0.3));
  const satTex = await loadSatelliteTexture(
    renderer.capabilities.getMaxAnisotropy(),
    (p) => setProgress(0.55 + p * 0.25)
  );
  const { material: mat, inject } = makeTerrainMaterial(satTex);
  // 串接 CSM 的 onBeforeCompile，再套用我們的衛星/雪混合注入
  csm.setupMaterial(mat);
  const csmOBC = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => { csmOBC(shader); inject(shader); };
  const mesh = new THREE.Mesh(terrain.geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  summit = terrain.summit;
  setProgress(0.85);

  // 3) 鏡頭就位 — 仰望峰頂
  controls.target.copy(summit).multiplyScalar(1);
  controls.target.y = summit.y * 0.82;
  camera.position.set(summit.x + 1700, summit.y * 0.9, summit.z + 1700);

  // 4) 後製
  ({ composer, bokeh } = setupPost(renderer, scene, camera));
  setProgress(1);

  // 等材質/貼圖編譯一兩幀後揭幕
  renderer.compile(scene, camera);
  setTimeout(() => loadingEl.classList.add('done'), 500);

  animate();
}

const _v = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  csm?.update();
  // DOF 對焦在峰頂
  if (bokeh && summit) {
    const dist = camera.position.distanceTo(summit);
    bokeh.uniforms.focus.value = dist;
  }
  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
  csm?.updateFrustums();
});

init().catch((e) => {
  console.error(e);
  loadingEl.querySelector('div').textContent = '載入失敗：' + e.message;
});
