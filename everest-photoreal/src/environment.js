import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// 載入 HDRI → 環境光（IBL）+ 可見天空 + 方向光（太陽 + 陰影）
export async function setupEnvironment(renderer, scene) {
  const hdr = await new RGBELoader().loadAsync('/hdri/sky.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(hdr).texture;
  scene.environment = envMap;   // 全場景的環境光與反射
  scene.background = hdr;        // 可見天空
  scene.backgroundBlurriness = 0.0;
  pmrem.dispose();

  // 高空大氣透視（遠景融入天色）。方向光與陰影改由 CSM 提供。
  scene.fog = new THREE.FogExp2(0xaecae8, 0.0001);
}
